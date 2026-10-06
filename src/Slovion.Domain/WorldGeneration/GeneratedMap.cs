namespace Slovion.Domain.WorldGeneration;

/// <summary>A species' spot placed by the generator.</summary>
public sealed record GeneratedSpot(string SpeciesId, GridPoint At);

/// <summary>A gate in a barrier, drawn with <paramref name="Tile"/>; it blocks until the save has <paramref name="Flag"/>.</summary>
public sealed record GeneratedGate(GridPoint At, string Flag, int Tile);

/// <summary>A rectangle of tiles belonging to <paramref name="Id"/> (a habitat or an area).</summary>
public sealed record ZoneRect(string Id, GridRect Rect, bool Underground = false);

/// <summary>
/// A whole map after generation: the template outside the generated areas, the generated terrain inside. Habitat zones
/// and area zones cover the generated areas only (the template keeps its own outside them). <see cref="Gates"/> are the
/// gates of barriers. <see cref="ZoneKinds"/> is the zone kind of every tile (for debugging), <see cref="Attempts"/> how
/// many tries the map took, and <see cref="Repaired"/> whether the fallback had to carve connections.
/// </summary>
public sealed record GeneratedMap(int Width, int Height, IReadOnlyList<int> Ground, IReadOnlyList<int> Decor, IReadOnlyList<bool> Blocked, IReadOnlyList<GeneratedSpot> Spots, IReadOnlyList<ZoneRect> HabitatZones, IReadOnlyList<ZoneRect> AreaZones, IReadOnlyList<GeneratedGate> Gates, IReadOnlyList<string?> ZoneKinds, int Attempts, bool Repaired);
