using Slovion.Domain.Discovery;

namespace Slovion.Domain.Content;

/// <summary>A research station's texts in one language: game labels, not facts.</summary>
public sealed record StationText(string Name, string Theme);

/// <summary>
/// A research station on a map: a themed list of species and how many of them a save must fully research (research
/// level 3). The goal is fictional gameplay data (docs/decisions.md D6); whether it is met is derived from research
/// levels and never stored (D3).
/// </summary>
public sealed record Station(string Id, string MapId, IReadOnlyList<SpeciesId> Species, int Goal, IReadOnlyDictionary<string, StationText> Text)
{
    /// <summary>How many of the station's species are fully researched, given each species' research level (missing: none).</summary>
    public int ResearchedCount(IReadOnlyDictionary<SpeciesId, int> levels)
    {
        ArgumentNullException.ThrowIfNull(levels);
        return Species.Count(id => levels.GetValueOrDefault(id) >= SpeciesDiscovery.MaxResearchLevel);
    }

    public bool IsMetBy(IReadOnlyDictionary<SpeciesId, int> levels) => ResearchedCount(levels) >= Goal;
}
