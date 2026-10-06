using Slovion.Application.Content;
using Slovion.Application.Stations;
using Slovion.Application.Weather;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Saves;
using Slovion.Domain.World;

namespace Slovion.Application.Discovery;

public sealed record CandidateView(SpeciesId SpeciesId, string Name);

/// <summary>What the player sees of an open encounter. Deliberately does not say which candidate is right.</summary>
public sealed record EncounterView(Guid EncounterId, SpeciesGroup Group, IReadOnlyList<string> Clues, IReadOnlyList<CandidateView> Candidates);

public abstract record StartEncounterResult
{
    private StartEncounterResult()
    {
    }

    /// <summary>The map or spot does not exist, or holds no species.</summary>
    public sealed record UnknownSpot : StartEncounterResult;

    /// <summary>The spot's species is not available at the save's in-game time (D8); nothing is recorded.</summary>
    public sealed record NotNow : StartEncounterResult;

    /// <summary>
    /// The save already identified this species; no encounter is opened. <see cref="Researched"/> says whether this
    /// sighting raised its research level; <see cref="NewCertificates"/> lists the research stations whose goal it met.
    /// </summary>
    public sealed record AlreadyIdentified(NatureDexEntry Entry, bool Researched, IReadOnlyList<CertificateView> NewCertificates) : StartEncounterResult;

    public sealed record Started(EncounterView Encounter) : StartEncounterResult;
}

public abstract record SearchResult
{
    private SearchResult()
    {
    }

    /// <summary>The map is unknown or the tile lies in no habitat zone.</summary>
    public sealed record UnknownHabitat : SearchResult;

    /// <summary>The search found nothing this time; nothing was recorded.</summary>
    public sealed record NothingFound : SearchResult;

    /// <summary>A species was found and handled like a spot interaction.</summary>
    public sealed record Found(StartEncounterResult Encounter) : SearchResult;
}

public abstract record AnswerResult
{
    private AnswerResult()
    {
    }

    /// <summary>No open encounter with this ID for this save (missing, answered, replaced, or another save's).</summary>
    public sealed record UnknownEncounter : AnswerResult;

    /// <summary>The answer is not one of the offered candidates; the encounter stays open.</summary>
    public sealed record NotACandidate : AnswerResult;

    /// <summary>The encounter is closed. <paramref name="Entry"/> is present when the answer was correct.</summary>
    public sealed record Answered(bool Correct, CandidateView CorrectSpecies, NatureDexEntry? Entry) : AnswerResult;
}

/// <summary>
/// Observation encounters and identification, decided by the server (docs/decisions.md D1, D3). Only species available
/// at the save's in-game time can be encountered (D8).
/// </summary>
public sealed class EncounterService(IContentCatalog content, IWorldMaps maps, IDiscoveryRepository discoveries, IEncounterRepository encounters, IRandomSource random, TimeProvider time)
{
    public async Task<StartEncounterResult> StartAsync(SaveSlot save, string mapId, string spotId, string language, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(save);
        var spot = maps.Find(save, mapId)?.FindSpot(spotId);
        var species = spot is null ? null : content.FindSpecies(spot.SpeciesId);
        if (spot is null || species is null)
        {
            return new StartEncounterResult.UnknownSpot();
        }

        var now = WorldTimeOf(save);
        if (!species.Availability.IsAvailableAt(now, WeatherService.At(content, mapId, now)))
        {
            return new StartEncounterResult.NotNow();
        }

        return await SightAsync(save, Sighting.AtSpot(spot), species, language, cancellationToken);
    }

    /// <summary>
    /// Searches the habitat at a tile (docs/decisions.md D3: rolled on an explicit action). Two draws from the
    /// random source decide whether anything is found and, by weight among the plants available now (D8), which.
    /// Animals are found by meeting them as residents, never by searching.
    /// </summary>
    public async Task<SearchResult> SearchAsync(SaveSlot save, string mapId, int x, int y, string language, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(save);
        var habitat = maps.Find(save, mapId)?.HabitatAt(x, y) is { } habitatId ? content.FindHabitat(habitatId) : null;
        if (habitat is null)
        {
            return new SearchResult.UnknownHabitat();
        }

        if (random.NextIndex(100) >= habitat.SearchChancePercent)
        {
            return new SearchResult.NothingFound();
        }

        var now = WorldTimeOf(save);
        var weather = WeatherService.At(content, mapId, now);
        var available = habitat.Species
            .Where(entry => content.FindSpecies(entry.SpeciesId) is { Group: SpeciesGroup.Plant } plant && plant.Availability.IsAvailableAt(now, weather))
            .ToList();
        if (available.Count == 0)
        {
            return new SearchResult.NothingFound();
        }

        var species = content.FindSpecies(PickByWeight(available))!;
        var sighting = Sighting.InHabitat(mapId, habitat.Id, species.Id);
        return new SearchResult.Found(await SightAsync(save, sighting, species, language, cancellationToken));
    }

    /// <summary>The save's in-game time now (docs/decisions.md D8).</summary>
    private WorldTime WorldTimeOf(SaveSlot save) => WorldTime.Since(save.CreatedAt, time.GetUtcNow());

    private SpeciesId PickByWeight(List<HabitatSpecies> candidates)
    {
        var roll = random.NextIndex(candidates.Sum(entry => entry.Weight));
        foreach (var entry in candidates)
        {
            if (roll < entry.Weight)
            {
                return entry.SpeciesId;
            }

            roll -= entry.Weight;
        }

        throw new InvalidOperationException("Weighted roll out of range.");
    }

    /// <summary>A sighting of a species: opens an encounter for an unidentified one, or researches an identified one.</summary>
    private async Task<StartEncounterResult> SightAsync(SaveSlot save, Sighting sighting, Species species, string language, CancellationToken cancellationToken)
    {
        var saveSlotId = save.Id;
        var known = await discoveries.FindAsync(saveSlotId, species.Id, cancellationToken);
        if (known is { IsIdentified: true })
        {
            // Sighting an identified species again may research it further.
            var (researched, advanced) = await discoveries.ResearchAsync(saveSlotId, species.Id, time.GetUtcNow(), save.CreatedAt, cancellationToken);
            var certificates = advanced && researched.ResearchLevel == SpeciesDiscovery.MaxResearchLevel
                ? StationService.EarnedBy(content, StationService.LevelsOf(await discoveries.ListAsync(saveSlotId, cancellationToken)), species.Id, language)
                : [];
            return new StartEncounterResult.AlreadyIdentified(NatureDexService.ToEntry(researched, species, language), advanced, certificates);
        }

        var now = time.GetUtcNow();
        await discoveries.AddIfAbsentAsync(SpeciesDiscovery.Observe(saveSlotId, sighting, now), cancellationToken);

        var candidates = CandidateSelector.Choose(species.Id, content.AllSpecies.Select(s => s.Id), random);
        var encounter = Encounter.Start(Guid.NewGuid(), saveSlotId, sighting, candidates, now);
        await encounters.StartAsync(encounter, cancellationToken);

        var (_, text) = SpeciesView.TextFor(species, language);
        return new StartEncounterResult.Started(new EncounterView(
            encounter.Id,
            species.Group,
            species.Clues.Select(index => text.Characteristics[index].Value).ToList(),
            candidates.Select(id => Candidate(id, language)).ToList()));
    }

    public async Task<AnswerResult> AnswerAsync(Guid saveSlotId, Guid encounterId, string answer, string language, CancellationToken cancellationToken)
    {
        var encounter = await encounters.FindOpenAsync(encounterId, saveSlotId, cancellationToken);
        if (encounter is null)
        {
            return new AnswerResult.UnknownEncounter();
        }

        if (!SpeciesId.IsValid(answer) || !encounter.IsCandidate(SpeciesId.Parse(answer)))
        {
            return new AnswerResult.NotACandidate();
        }

        var now = time.GetUtcNow();
        if (!await encounters.CloseAsync(encounterId, saveSlotId, now, cancellationToken))
        {
            return new AnswerResult.UnknownEncounter(); // answered concurrently
        }

        var correct = encounter.IsCorrect(SpeciesId.Parse(answer));
        NatureDexEntry? entry = null;
        if (correct && content.FindSpecies(encounter.SpeciesId) is { } species)
        {
            var identified = await discoveries.IdentifyAsync(saveSlotId, species.Id, now, cancellationToken);
            entry = NatureDexService.ToEntry(identified, species, language);
        }

        return new AnswerResult.Answered(correct, Candidate(encounter.SpeciesId, language), entry);
    }

    private CandidateView Candidate(SpeciesId id, string language)
    {
        var species = content.FindSpecies(id)
            ?? throw new InvalidOperationException($"Species '{id}' is not in the content catalog.");
        return new CandidateView(id, SpeciesView.TextFor(species, language).Text.Name.Value);
    }
}
