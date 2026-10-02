using Slovion.Application.Content;
using Slovion.Domain.Content;

namespace Slovion.Application.Discovery;

public sealed record SourceView(string Title, string Publisher, Uri Url, DateOnly Accessed, string Licence);

/// <summary>Species information in one language, with every source it is based on.</summary>
public sealed record SpeciesView(
    string Language,
    string Name,
    string ScientificName,
    string Family,
    string Habitat,
    string Distribution,
    string Season,
    IReadOnlyList<string> Characteristics,
    IReadOnlyList<SourceView> Sources)
{
    /// <summary>Text in <paramref name="language"/>, or Slovenian when the species lacks that language.</summary>
    public static SpeciesView For(Species species, string language)
    {
        ArgumentNullException.ThrowIfNull(species);
        var used = species.Text.ContainsKey(language) ? language : IContentCatalog.DefaultLanguage;
        var text = species.Text[used];

        Fact[] facts = [species.ScientificName, text.Name, text.Family, text.Habitat, text.Distribution, text.Season, .. text.Characteristics];
        var sourceIds = facts.SelectMany(fact => fact.SourceIds).ToHashSet(StringComparer.Ordinal);
        var sources = species.Sources.Values
            .Where(source => sourceIds.Contains(source.Id))
            .Select(source => new SourceView(source.Title, source.Publisher, source.Url, source.Accessed, source.Licence))
            .ToList();

        return new SpeciesView(
            used,
            text.Name.Value,
            species.ScientificName.Value,
            text.Family.Value,
            text.Habitat.Value,
            text.Distribution.Value,
            text.Season.Value,
            text.Characteristics.Select(fact => fact.Value).ToList(),
            sources);
    }
}

public sealed record NatureDexEntry(SpeciesId SpeciesId, DateTimeOffset DiscoveredAt, SpeciesView Species);
