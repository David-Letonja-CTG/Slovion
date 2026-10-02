using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

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

    /// <summary>The save already identified this species; no encounter is opened.</summary>
    public sealed record AlreadyIdentified(NatureDexEntry Entry) : StartEncounterResult;

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

/// <summary>Observation encounters and identification, decided by the server (docs/decisions.md D1, D3).</summary>
public sealed class EncounterService(IContentCatalog content, IDiscoveryRepository discoveries, IEncounterRepository encounters, IRandomSource random, TimeProvider time)
{
    public async Task<StartEncounterResult> StartAsync(Guid saveSlotId, string mapId, string spotId, string language, CancellationToken cancellationToken)
    {
        var spot = content.FindSpot(mapId, spotId);
        var species = spot is null ? null : content.FindSpecies(spot.SpeciesId);
        if (spot is null || species is null)
        {
            return new StartEncounterResult.UnknownSpot();
        }

        return await StartAsync(saveSlotId, Sighting.AtSpot(spot), species, language, cancellationToken);
    }

    /// <summary>
    /// Searches the habitat at a tile (docs/decisions.md D3: rolled on an explicit action). Two draws from the
    /// random source decide whether anything is found and, by weight, which species.
    /// </summary>
    public async Task<SearchResult> SearchAsync(Guid saveSlotId, string mapId, int x, int y, string language, CancellationToken cancellationToken)
    {
        var habitat = content.FindHabitatAt(mapId, x, y);
        if (habitat is null)
        {
            return new SearchResult.UnknownHabitat();
        }

        if (random.NextIndex(100) >= habitat.SearchChancePercent)
        {
            return new SearchResult.NothingFound();
        }

        var species = content.FindSpecies(PickByWeight(habitat))
            ?? throw new InvalidOperationException($"Habitat '{habitat.Id}' names a species missing from the catalog.");
        var sighting = Sighting.InHabitat(mapId, habitat.Id, species.Id);
        return new SearchResult.Found(await StartAsync(saveSlotId, sighting, species, language, cancellationToken));
    }

    private SpeciesId PickByWeight(Habitat habitat)
    {
        var roll = random.NextIndex(habitat.Species.Sum(entry => entry.Weight));
        foreach (var entry in habitat.Species)
        {
            if (roll < entry.Weight)
            {
                return entry.SpeciesId;
            }

            roll -= entry.Weight;
        }

        throw new InvalidOperationException("Weighted roll out of range.");
    }

    private async Task<StartEncounterResult> StartAsync(Guid saveSlotId, Sighting sighting, Species species, string language, CancellationToken cancellationToken)
    {
        var known = await discoveries.FindAsync(saveSlotId, species.Id, cancellationToken);
        if (known is { IsIdentified: true })
        {
            return new StartEncounterResult.AlreadyIdentified(NatureDexService.ToEntry(known, species, language));
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
