using System.Text.Json;

namespace Slovion.Infrastructure.Content;

// JSON shapes of the content files. Everything is nullable so the validator can report
// missing fields itself instead of failing on the first deserialization error.

internal sealed record FactFile(string? Value, List<string>? Sources);

internal sealed record SourceFile(string? Title, string? Publisher, string? Url, string? Accessed, string? Licence);

internal sealed record SpeciesTextFile(
    FactFile? Name,
    FactFile? Family,
    FactFile? Habitat,
    FactFile? Distribution,
    FactFile? Season,
    List<FactFile>? Characteristics);

internal sealed record SpeciesFile(
    string? Id,
    string? Group,
    FactFile? ScientificName,
    Dictionary<string, SourceFile>? Sources,
    Dictionary<string, SpeciesTextFile>? Text);

/// <summary>The subset of the Tiled JSON map format that Slovion uses on the server.</summary>
internal sealed record TiledMapFile(
    string? Orientation,
    int Width,
    int Height,
    int TileWidth,
    int TileHeight,
    List<TiledLayerFile>? Layers);

internal sealed record TiledLayerFile(string? Name, string? Type, List<int>? Data, List<TiledObjectFile>? Objects);

/// <summary>Tiled writes the object class as <c>type</c> in JSON; <c>class</c> is accepted too.</summary>
internal sealed record TiledObjectFile(
    string? Name,
    string? Type,
    string? Class,
    double X,
    double Y,
    List<TiledPropertyFile>? Properties)
{
    public string? ObjectClass => string.IsNullOrEmpty(Type) ? Class : Type;

    public string? StringProperty(string name) =>
        Properties?.FirstOrDefault(property => property.Name == name)?.Value is { ValueKind: JsonValueKind.String } value
            ? value.GetString()
            : null;
}

internal sealed record TiledPropertyFile(string? Name, string? Type, JsonElement Value);
