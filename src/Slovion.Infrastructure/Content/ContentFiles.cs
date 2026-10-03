using System.Text.Json;

namespace Slovion.Infrastructure.Content;

// JSON shapes of the content files. Everything is nullable so the validator can report
// missing fields itself instead of failing on the first deserialization error.

internal sealed record FactFile(string? Value, List<string>? Sources);

internal sealed record SourceFile(string? Title, string? Publisher, string? Url, string? Accessed, string? Licence);

internal sealed record SpeciesTextFile(FactFile? Name, FactFile? Family, FactFile? Habitat, FactFile? Distribution, FactFile? Season, List<FactFile>? Characteristics);

/// <summary>Gameplay data: indices into <c>characteristics</c> used as identification clues.</summary>
internal sealed record IdentificationFile(List<int>? Clues);

/// <summary>When a species can be found: seasons, optional times of day (all when absent), and the sources behind them.</summary>
internal sealed record AvailabilityFile(List<string>? Seasons, List<string>? Times, List<string>? Sources);

/// <summary>Fictional gameplay traits of an animal: its reaction to the torch.</summary>
internal sealed record WildlifeFile(string? Torch);

internal sealed record SpeciesFile(string? Id, string? Group, FactFile? ScientificName, Dictionary<string, SourceFile>? Sources, Dictionary<string, SpeciesTextFile>? Text, AvailabilityFile? Availability, WildlifeFile? Wildlife, IdentificationFile? Identification);

/// <summary>The subset of the Tiled JSON map format that Slovion uses on the server.</summary>
internal sealed record TiledMapFile(string? Orientation, int Width, int Height, int TileWidth, int TileHeight, List<TiledLayerFile>? Layers, List<TiledTilesetFile>? Tilesets);

internal sealed record TiledTilesetFile(int Tilecount, List<TiledTileFile>? Tiles);

/// <summary>Per-tile data of a tileset; Slovion uses only frame animations.</summary>
internal sealed record TiledTileFile(int Id, List<TiledFrameFile>? Animation);

internal sealed record TiledFrameFile(int Tileid, int Duration);

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

/// <summary>How many species to identify, optionally only species of one habitat.</summary>
internal sealed record QuestGoalFile(int IdentifiedSpecies, string? Habitat);

internal sealed record QuestRewardFile(string? Flag);

internal sealed record QuestDialogueFile(List<string>? Offer, List<string>? Active, List<string>? Ready, List<string>? Completed);

internal sealed record QuestTextFile(string? Title, string? Summary, string? ReturnHint, QuestDialogueFile? Dialogue);

/// <summary>A quest: its giver, goal, reward flag, and texts per language (dialogue per quest state).</summary>
internal sealed record QuestFile(string? Id, string? Giver, QuestGoalFile? Goal, QuestRewardFile? Reward, Dictionary<string, QuestTextFile>? Text);

internal sealed record HabitatSpeciesFile(string? SpeciesId, int Weight);

internal sealed record HabitatTextFile(string? Name);

/// <summary>A habitat's localized display name and fictional gameplay values (search chance, species weights).</summary>
internal sealed record HabitatFile(string? Id, Dictionary<string, HabitatTextFile>? Text, int? Order, int SearchChancePercent, List<HabitatSpeciesFile>? Species);

internal sealed record RegionTextFile(string? Name, string? LockedHint);

internal sealed record RegionPositionFile(int? X, int? Y);

/// <summary>At most one rule: a flag, or a number of identified species. None means always open.</summary>
internal sealed record RegionUnlockFile(string? Flag, int? IdentifiedSpecies);

/// <summary>A travel destination: its map, travel-map position and list order, unlock rule, and texts per language.</summary>
internal sealed record RegionFile(string? Id, string? MapId, int? Order, RegionPositionFile? Position, RegionUnlockFile? Unlock, Dictionary<string, RegionTextFile>? Text);

internal sealed record AreaTextFile(string? Name);

/// <summary>A named place in the world (a game label, not a fact).</summary>
internal sealed record AreaFile(string? Id, Dictionary<string, AreaTextFile>? Text);

/// <summary>Tiles (inclusive) covered by a map zone (habitat or area): those whose centre lies inside the rectangle.</summary>
internal sealed record MapZone(string Id, int MinX, int MinY, int MaxX, int MaxY)
{
    public bool Contains(int x, int y) => x >= MinX && x <= MaxX && y >= MinY && y <= MaxY;

    public bool Overlaps(MapZone other) =>
        MinX <= other.MaxX && other.MinX <= MaxX && MinY <= other.MaxY && other.MinY <= MaxY;
}
