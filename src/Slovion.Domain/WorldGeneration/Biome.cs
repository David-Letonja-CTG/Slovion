using System.Globalization;

namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// What a biome looks like, as data (design §5): its floor, terrain layers grown from noise, openings, water, paths,
/// decoration and the habitat zone kinds derived from all of that. Tiles are tileset indices (Tiled GID − 1). The
/// generator interprets these generic rules only; it knows no biome by name.
/// </summary>
public sealed record Biome(string Id, IReadOnlyList<int> Floor, int PathSet, IReadOnlyList<int> Border, IReadOnlyList<TerrainLayer> Layers, Openings? Openings, Water? Water, IReadOnlyList<DecorRule> Decor, IReadOnlyList<ZoneRule> Zones);

/// <summary>
/// A terrain grown from smoothed noise: it covers <paramref name="Coverage"/> of the area, in blobs about
/// <paramref name="Scale"/> tiles across, smoothed <paramref name="Smooth"/> times; optionally with its own floor.
/// </summary>
public sealed record TerrainLayer(string Id, double Coverage, int Scale, int Smooth, IReadOnlyList<int>? Floor);

/// <summary>Round open places (clearings, meadows) that paths lead to, with their own floor and path tiles.</summary>
public sealed record Openings(int MinCount, int MaxCount, int MinRadius, int MaxRadius, IReadOnlyList<int> Floor, int PathSet);

public enum WaterKind
{
    /// <summary>A line of water crossing the area from one edge to the opposite one.</summary>
    Stream,

    /// <summary>A round body of water inside the area.</summary>
    Pond,
}

/// <summary>Water of the biome: present with <paramref name="Chance"/>, <paramref name="Size"/> wide (stream) or across (pond).</summary>
public sealed record Water(WaterKind Kind, double Chance, int Size, IReadOnlyList<int> Tiles, IReadOnlyList<int>? Bank);

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
}

/// <summary>
/// Which cells a rule applies to, written in content as <c>any</c>, <c>floor</c>, <c>opening</c>, <c>water</c>,
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
            ["layer", { Length: > 0 } layer] => new CellSelector(SelectorKind.Layer, layer),
            ["edge", { Length: > 0 } layer] => new CellSelector(SelectorKind.Edge, layer),
            ["edge", { Length: > 0 } layer, _] when distance > 0 => new CellSelector(SelectorKind.Edge, layer, distance),
            ["near", "water"] => new CellSelector(SelectorKind.NearWater),
            ["near", "water", _] when distance > 0 => new CellSelector(SelectorKind.NearWater, null, distance),
            _ => null,
        };
    }
}
