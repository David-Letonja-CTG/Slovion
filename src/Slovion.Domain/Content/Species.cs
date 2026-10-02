namespace Slovion.Domain.Content;

/// <summary>A real-world fact and the IDs of the sources it is based on (docs/decisions.md D6).</summary>
public sealed record Fact(string Value, IReadOnlyList<string> SourceIds);

/// <summary>Where real-world species facts come from.</summary>
public sealed record Source(string Id, string Title, string Publisher, Uri Url, DateOnly Accessed, string Licence);

/// <summary>Species facts in one language.</summary>
public sealed record SpeciesText(
    Fact Name,
    Fact Family,
    Fact Habitat,
    Fact Distribution,
    Fact Season,
    IReadOnlyList<Fact> Characteristics);

/// <summary>Real-world species content. Contains no gameplay values.</summary>
public sealed record Species(
    SpeciesId Id,
    string Group,
    Fact ScientificName,
    IReadOnlyDictionary<string, Source> Sources,
    IReadOnlyDictionary<string, SpeciesText> Text);

/// <summary>An interactive place in a map where a species can be discovered.</summary>
public sealed record MapSpot(string MapId, string SpotId, SpeciesId SpeciesId);
