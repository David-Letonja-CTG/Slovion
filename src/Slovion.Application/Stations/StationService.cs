using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Saves;

namespace Slovion.Application.Stations;

/// <summary>A station's species as one save knows it: research level 0 and no name until identified.</summary>
public sealed record StationSpeciesView(SpeciesId SpeciesId, int Level, string? Name);

/// <summary>A research station as one save sees it, in one language.</summary>
public sealed record StationView(string StationId, string Name, string Theme, string MapId, int Goal, int Researched, bool Met, IReadOnlyList<StationSpeciesView> Species);

/// <summary>A station whose goal a research step has just met.</summary>
public sealed record CertificateView(string StationId, string Name);

/// <summary>
/// Research stations (docs/product-vision.md): progress is derived from the save's research levels, so nothing is
/// stored (D3).
/// </summary>
public sealed class StationService(IContentCatalog content, IDiscoveryRepository discoveries)
{
    /// <summary>Every station with the save's progress, in region order.</summary>
    public async Task<IReadOnlyList<StationView>> ListAsync(SaveSlot save, string language, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(save);
        var levels = await LevelsAsync(save.Id, cancellationToken);
        return content.AllStations.Select(station => ViewOf(station, levels, language)).ToList();
    }

    /// <summary>
    /// The certificates earned by raising <paramref name="speciesId"/> to the highest research level, given the save's levels
    /// after that step: the stations listing it whose researched count now equals their goal. Before the step the species
    /// was not fully researched, so those goals were not met yet.
    /// </summary>
    internal static IReadOnlyList<CertificateView> EarnedBy(IContentCatalog content, IReadOnlyDictionary<SpeciesId, int> levels, SpeciesId speciesId, string language) =>
        content.AllStations
            .Where(station => station.Species.Contains(speciesId) && station.ResearchedCount(levels) == station.Goal)
            .Select(station => new CertificateView(station.Id, TextOf(station, language).Name))
            .ToList();

    /// <summary>The research level of every identified species.</summary>
    internal static Dictionary<SpeciesId, int> LevelsOf(IEnumerable<SpeciesDiscovery> discoveries) =>
        discoveries.Where(discovery => discovery.IsIdentified).ToDictionary(discovery => discovery.SpeciesId, discovery => discovery.ResearchLevel);

    private async Task<Dictionary<SpeciesId, int>> LevelsAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        LevelsOf(await discoveries.ListAsync(saveSlotId, cancellationToken));

    private StationView ViewOf(Station station, Dictionary<SpeciesId, int> levels, string language)
    {
        var text = TextOf(station, language);
        var species = station.Species
            .Select(id => levels.TryGetValue(id, out var level)
                ? new StationSpeciesView(id, level, NameOf(id, language))
                : new StationSpeciesView(id, 0, null))
            .ToList();
        var researched = station.ResearchedCount(levels);
        return new StationView(station.Id, text.Name, text.Theme, station.MapId, station.Goal, researched, researched >= station.Goal, species);
    }

    private string? NameOf(SpeciesId id, string language) =>
        content.FindSpecies(id) is { } species
            ? (species.Text.TryGetValue(language, out var text) ? text : species.Text[IContentCatalog.DefaultLanguage]).Name.Value
            : null;

    private static StationText TextOf(Station station, string language) =>
        station.Text.TryGetValue(language, out var text) ? text : station.Text[IContentCatalog.DefaultLanguage];
}
