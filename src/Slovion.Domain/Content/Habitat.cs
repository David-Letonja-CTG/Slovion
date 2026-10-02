namespace Slovion.Domain.Content;

/// <summary>How likely a species is found when searching a habitat. Fictional gameplay data (D6).</summary>
public sealed record HabitatSpecies(SpeciesId SpeciesId, int Weight);

/// <summary>
/// A searchable habitat with fictional encounter values: the chance that a search finds anything, and
/// the relative weights (rarity) of the species that can be found (docs/decisions.md D6, D7).
/// </summary>
public sealed record Habitat(string Id, int SearchChancePercent, IReadOnlyList<HabitatSpecies> Species);
