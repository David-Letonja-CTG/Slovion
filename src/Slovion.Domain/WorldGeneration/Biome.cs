using System.Globalization;

namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// What a biome looks like, as data (design §5): its floor, terrain layers grown from noise, openings, water, paths,
/// decoration and the habitat zone kinds derived from all of that. Tiles are tileset indices (Tiled GID − 1); without a
/// <c>PathSet</c> paths keep the floor (a cave). <c>Gate</c> is the tile of a gate in its border (a barrier, design §4a).
/// <c>Structures</c> are placed whole (houses, salt-pan basins) and <c>Lamps</c> stand beside the paths (design §5a).
/// The generator interprets these generic rules only; it knows no biome by name.
/// </summary>
public sealed record Biome(string Id, IReadOnlyList<int> Floor, int? PathSet, IReadOnlyList<int> Border, IReadOnlyList<TerrainLayer> Layers, Openings? Openings, Water? Water, IReadOnlyList<DecorRule> Decor, IReadOnlyList<ZoneRule> Zones, int? Gate = null, IReadOnlyList<StructureRule>? Structures = null, Lamps? Lamps = null);

/// <summary>
/// A small authored block placed whole (design §5a): its ground tiles row by row and whether it blocks; a door, whose
/// tile below is kept open and reached by a path; perches (a chimney) for perched species. Its open tiles get the zone
/// kind <paramref name="Zone"/>, its perches <paramref name="PerchZone"/>.
/// </summary>
public sealed record Prefab(string Id, int Width, int Height, IReadOnlyList<int> Ground, bool Blocking, GridPoint? Door, IReadOnlyList<GridPoint> Perches, string? Zone, string? PerchZone);

/// <summary>How many of a structure a biome places, and whether they stand in a row along the area's north edge.</summary>
public sealed record StructureRule(Prefab Prefab, int MinCount, int MaxCount, bool AlongNorth);

/// <summary>Lamp posts (drawn with <paramref name="Tile"/>) beside the paths, at least <paramref name="Spacing"/> tiles apart.</summary>
public sealed record Lamps(int Tile, int Spacing);

/// <summary>
/// A terrain grown from smoothed noise: it covers <paramref name="Coverage"/> of the area, in blobs about
/// <paramref name="Scale"/> tiles across, smoothed <paramref name="Smooth"/> times; optionally with its own floor,
/// which may block (reeds, rock). <paramref name="Bias"/> pulls it towards one edge of the area (snow towards the
/// peaks) by <paramref name="BiasStrength"/> (0–1).
/// </summary>
public sealed record TerrainLayer(string Id, double Coverage, int Scale, int Smooth, IReadOnlyList<int>? Floor, bool Blocking = false, Edge? Bias = null, double BiasStrength = 0);

/// <summary>A side of a generated area.</summary>
public enum Edge
{
    North,
    East,
    South,
    West,
}

/// <summary>Round open places (clearings, meadows) that paths lead to, with their own floor and path tiles.</summary>
public sealed record Openings(int MinCount, int MaxCount, int MinRadius, int MaxRadius, IReadOnlyList<int> Floor, int? PathSet);

public enum WaterKind
{
    /// <summary>A line of water crossing the area from one edge to the opposite one.</summary>
    Stream,

    /// <summary>A round body of water inside the area.</summary>
    Pond,

    /// <summary>Water along one edge of the area (a lake shore, the sea), with a ragged shoreline and shallows on the land side.</summary>
    Shore,
}

/// <summary>
/// Water of the biome: present with <paramref name="Chance"/>, <paramref name="Size"/> wide (stream), across (pond)
/// or deep (shore, along <paramref name="Edge"/>); a shore's <paramref name="ShallowWidth"/> rows nearest the land use
/// <paramref name="Shallow"/> tiles (wadeable or swimmable ones let the boots or the snorkel through).
/// </summary>
public sealed record Water(WaterKind Kind, double Chance, int Size, IReadOnlyList<int> Tiles, IReadOnlyList<int>? Bank, Edge Edge = Edge.South, IReadOnlyList<int>? Shallow = null, int ShallowWidth = 0);

/// <summary>Decoration on cells chosen by <paramref name="Where"/>, each with <paramref name="Density"/>; blocking or not.</summary>
public sealed record DecorRule(IReadOnlyList<int> Tiles, bool Blocking, double Density, CellSelector Where);

/// <summary>A zone kind for cells chosen by <paramref name="Where"/>; with a habitat it is searchable, without it only places species.</summary>
public sealed record ZoneRule(string Kind, CellSelector Where, string? HabitatId);

public enum SelectorKind
{
    /// <summary>Every cell.</summary>
    Any,

    /// <summary>Cells in no layer, opening or water.</summary>
    Floor,

    /// <summary>Cells of a terrain layer.</summary>
    Layer,

    /// <summary>Cells of an opening.</summary>
    Opening,

    /// <summary>Cells within a distance of the boundary of a terrain layer (both sides).</summary>
    Edge,

    /// <summary>Land cells within a distance of water.</summary>
    NearWater,

    /// <summary>Water cells.</summary>
    Water,

    /// <summary>Cells of a structure, which take the structure's own zone kind.</summary>
    Structure,
}

/// <summary>
/// Which cells a rule applies to, written in content as <c>any</c>, <c>floor</c>, <c>opening</c>, <c>water</c>, <c>structure</c>,
/// <c>layer:&lt;id&gt;</c>, <c>edge:&lt;id&gt;[:distance]</c> or <c>near:water[:distance]</c>.
/// </summary>
public sealed record CellSelector(SelectorKind Kind, string? Layer = null, int Distance = 1)
{
    /// <summary>Parses the content form; <c>null</c> when it is not valid.</summary>
    public static CellSelector? Parse(string? text)
    {
        var parts = (text ?? string.Empty).Split(':');
        var distance = 1;
        if (parts.Length == 3 && !int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out distance))
        {
            return null;
        }

        return parts switch
        {
            ["any"] => new CellSelector(SelectorKind.Any),
            ["floor"] => new CellSelector(SelectorKind.Floor),
            ["opening"] => new CellSelector(SelectorKind.Opening),
            ["water"] => new CellSelector(SelectorKind.Water),
            ["structure"] => new CellSelector(SelectorKind.Structure),
            ["layer", { Length: > 0 } layer] => new CellSelector(SelectorKind.Layer, layer),
            ["edge", { Length: > 0 } layer] => new CellSelector(SelectorKind.Edge, layer),
            ["edge", { Length: > 0 } layer, _] when distance > 0 => new CellSelector(SelectorKind.Edge, layer, distance),
            ["near", "water"] => new CellSelector(SelectorKind.NearWater),
            ["near", "water", _] when distance > 0 => new CellSelector(SelectorKind.NearWater, null, distance),
            _ => null,
        };
    }
}
