namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// A region's map as authored (design §4): its tiles and the blocking objects (people, signpost, station…) outside the
/// generated areas, the spawn, and the areas the generator fills. Tiles are tileset indices, −1 for none.
/// <paramref name="PathTiles"/> are the tiles that count as path when a generated path meets an authored one, and
/// <paramref name="WadeableTiles"/> the water the boots let the player through.
/// </summary>
public sealed record MapTemplate(string MapId, int Width, int Height, IReadOnlyList<int> Ground, IReadOnlyList<int> Decor, IReadOnlyList<bool> Blocked, IReadOnlySet<int> PathTiles, GridPoint Spawn, IReadOnlyList<GridPoint> BlockingObjects, IReadOnlyList<GenerationArea> Areas, IReadOnlySet<int>? WadeableTiles = null);

/// <summary>
/// A rectangle the generator fills with <paramref name="BiomeId"/>: it becomes area <paramref name="AreaId"/> and holds
/// one spot of each listed species. <paramref name="Connectors"/> are tiles on its edge where authored paths come in.
/// </summary>
public sealed record GenerationArea(GridRect Rect, string BiomeId, string AreaId, bool Underground, IReadOnlyList<SpeciesRequest> Species, IReadOnlyList<GridPoint> Connectors);

/// <summary>A species to place, with where it may live (already resolved against the biome by the caller).</summary>
public sealed record SpeciesRequest(string SpeciesId, SpeciesPlacement Placement);

public enum WaterNeed
{
    None,

    /// <summary>Within three tiles of water.</summary>
    Near,

    /// <summary>On a water tile, beside reachable land.</summary>
    In,

    /// <summary>On wadeable water away from the shore: reached only by wading, with the boots.</summary>
    Wade,
}

/// <summary>
/// Where a species may get its spot: zone kinds in order of preference (design §7), its need for water, whether it
/// sits on a blocking perch (a tree, a rock), and for a plant the decoration tile drawn at its spot and whether it
/// blocks. Fictional gameplay data (D6), never shown to players.
/// </summary>
public sealed record SpeciesPlacement(IReadOnlyList<string> Zones, WaterNeed Water = WaterNeed.None, bool Perched = false, int? Tile = null, bool Blocking = false, bool NearSpawn = false);
