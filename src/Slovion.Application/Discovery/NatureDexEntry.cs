using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Application.Discovery;

public sealed record SourceView(string Title, string Publisher, Uri Url, DateOnly Accessed, string Licence);

/// <summary>
/// Species information in one language, as far as the save's research has revealed it, with the sources of the revealed
/// facts. <see cref="Habitat"/> and <see cref="Distribution"/> are revealed at research level 2, <see cref="Season"/> at 3.
/// </summary>
public sealed record SpeciesView(string Language, string Name, string ScientificName, string Family, string? Habitat, string? Distribution, string? Season, IReadOnlyList<string> Characteristics, IReadOnlyList<SourceView> Sources)
{
    public const int HabitatLevel = 2;
    public const int SeasonLevel = 3;

    /// <summary>
    /// The facts revealed at <paramref name="researchLevel"/>, in <paramref name="language"/> or Slovenian when the species
    /// lacks that language.
    /// </summary>
    public static SpeciesView For(Species species, string language, int researchLevel)
    {
        var (used, text) = TextFor(species, language);
        var habitat = researchLevel >= HabitatLevel ? text.Habitat : null;
        var distribution = researchLevel >= HabitatLevel ? text.Distribution : null;
        var season = researchLevel >= SeasonLevel ? text.Season : null;

        Fact?[] facts = [species.ScientificName, text.Name, text.Family, habitat, distribution, season, .. text.Characteristics];
        var sourceIds = facts.OfType<Fact>().SelectMany(fact => fact.SourceIds).ToHashSet(StringComparer.Ordinal);
        var sources = species.Sources.Values
            .Where(source => sourceIds.Contains(source.Id))
            .Select(source => new SourceView(source.Title, source.Publisher, source.Url, source.Accessed, source.Licence))
            .ToList();

        return new SpeciesView(
            used,
            text.Name.Value,
            species.ScientificName.Value,
            text.Family.Value,
            habitat?.Value,
            distribution?.Value,
            season?.Value,
            text.Characteristics.Select(fact => fact.Value).ToList(),
            sources);
    }

    /// <summary>The species text in <paramref name="language"/>, falling back to Slovenian.</summary>
    public static (string Language, SpeciesText Text) TextFor(Species species, string language)
    {
        ArgumentNullException.ThrowIfNull(species);
        var used = species.Text.ContainsKey(language) ? language : IContentCatalog.DefaultLanguage;
        return (used, species.Text[used]);
    }
}

/// <summary>
/// A species in a save's NatureDex. <see cref="Species"/> and <see cref="ResearchLevel"/> are present only once
/// identified; an observed species stays anonymous (docs/decisions.md D1).
/// </summary>
public sealed record NatureDexEntry(SpeciesId SpeciesId, SpeciesGroup Group, DateTimeOffset ObservedAt, DateTimeOffset? IdentifiedAt, int? ResearchLevel, SpeciesView? Species)
{
    public bool IsIdentified => IdentifiedAt is not null;
}

/// <summary>A species' place in a NatureDex section. <see cref="Entry"/> is <c>null</c> while the save has not observed it.</summary>
public sealed record NatureDexSlot(SpeciesId SpeciesId, NatureDexEntry? Entry);

/// <summary>A habitat's part of the NatureDex: its localized name and every species it lists, in content order.</summary>
public sealed record NatureDexSection(string HabitatId, string Name, IReadOnlyList<NatureDexSlot> Species);
