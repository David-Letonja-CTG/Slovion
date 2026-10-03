using System.Text.Json;

namespace Slovion.Infrastructure.Content;

// JSON shapes of the content files. Everything is nullable so the validator can report
// missing fields itself instead of failing on the first deserialization error.

internal sealed record FactFile(string? Value, List<string>? Sources);

internal sealed record SourceFile(string? Title, string? Publisher, string? Url, string? Accessed, string? Licence);

internal sealed record SpeciesTextFile(FactFile? Name, FactFile? Family, FactFile? Habitat, FactFile? Distribution, FactFile? Season, List<FactFile>? Characteristics);

/// <summary>Gameplay data: indices into <c>characteristics</c> used as identification clues.</summary>
internal sealed record IdentificationFile(List<int>? Clues);

internal sealed record SpeciesFile(string? Id, string? Group, FactFile? ScientificName, Dictionary<string, SourceFile>? Sources, Dictionary<string, SpeciesTextFile>? Text, IdentificationFile? Identification);

/// <summary>The subset of the Tiled JSON map format that Slovion uses on the server.</summary>
internal sealed record TiledMapFile(string? Orientation, int Width, int Height, int TileWidth, int TileHeight, List<TiledLayerFile>? Layers);

internal sealed record TiledLayerFile(string? Name, string? Type, List<int>? Data, List<TiledObjectFile>? Objects);

/// <summary>Tiled writes the object class as <c>type</c> in JSON; <c>class</c> is accepted too.</summary>
internal sealed record TiledObjectFile(string? Name, string? Type, string? Class, double X, double Y, double Width, double Height, int Gid, List<TiledPropertyFile>? Properties)
{
    public string? ObjectClass => string.IsNullOrEmpty(Type) ? Class : Type;

    public string? StringProperty(string name) =>
        Properties?.FirstOrDefault(property => property.Name == name)?.Value is { ValueKind: JsonValueKind.String } value
            ? value.GetString()
            : null;
}

internal sealed record TiledPropertyFile(string? Name, string? Type, JsonElement Value);

internal sealed record NpcTextFile(string? Name);

internal sealed record NpcFile(string? Id, Dictionary<string, NpcTextFile>? Text);

internal sealed record QuestGoalFile(int IdentifiedSpecies);

internal sealed record QuestRewardFile(string? Flag);

internal sealed record QuestDialogueFile(List<string>? Offer, List<string>? Active, List<string>? Ready, List<string>? Completed);

internal sealed record QuestTextFile(string? Title, string? Summary, string? ReturnHint, QuestDialogueFile? Dialogue);

/// <summary>A quest: its giver, goal, reward flag, and texts per language (dialogue per quest state).</summary>
internal sealed record QuestFile(string? Id, string? Giver, QuestGoalFile? Goal, QuestRewardFile? Reward, Dictionary<string, QuestTextFile>? Text);

internal sealed record HabitatSpeciesFile(string? SpeciesId, int Weight);

internal sealed record HabitatTextFile(string? Name);

/// <summary>A habitat's localized display name and fictional gameplay values (search chance, species weights).</summary>
internal sealed record HabitatFile(string? Id, Dictionary<string, HabitatTextFile>? Text, int? Order, int SearchChancePercent, List<HabitatSpeciesFile>? Species);

/// <summary>Tiles (inclusive) covered by a habitat zone: those whose centre lies inside the rectangle.</summary>
internal sealed record HabitatZone(string HabitatId, int MinX, int MinY, int MaxX, int MaxY)
{
    public bool Contains(int x, int y) => x >= MinX && x <= MaxX && y >= MinY && y <= MaxY;

    public bool Overlaps(HabitatZone other) =>
        MinX <= other.MaxX && other.MinX <= MaxX && MinY <= other.MaxY && other.MinY <= MaxY;
}
