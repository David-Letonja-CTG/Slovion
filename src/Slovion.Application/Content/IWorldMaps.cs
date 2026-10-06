using Slovion.Domain.Content;
using Slovion.Domain.Saves;

namespace Slovion.Application.Content;

/// <summary>
/// The maps of a save (docs/decisions.md D13): an authored map is the same for every save; a natural one is generated
/// from its template, the region's biomes and the save's world seed. Encounters, searches and wildlife use these, never
/// a map's template.
/// </summary>
public interface IWorldMaps
{
    /// <summary>The save's map, or <c>null</c> when the map is unknown.</summary>
    SaveMap? Find(SaveSlot save, string mapId);
}

/// <summary>A tile rectangle (inclusive) of a map belonging to a habitat.</summary>
public sealed record MapHabitatZone(string HabitatId, int MinX, int MinY, int MaxX, int MaxY)
{
    public bool Contains(int x, int y) => x >= MinX && x <= MaxX && y >= MinY && y <= MaxY;
}

/// <summary>How a generated map was made: the save's world seed, the generation version and the biomes of its areas.</summary>
public sealed record WorldDetails(long Seed, int Version, IReadOnlyList<string> Biomes);

/// <summary>
/// One map as a save sees it: its spots and habitat zones, its Tiled JSON for the client with an entity tag that changes
/// whenever the JSON does, and for a generated map how it was made.
/// </summary>
public sealed class SaveMap(string mapId, IReadOnlyList<MapSpot> spots, IReadOnlyList<MapHabitatZone> habitats, ReadOnlyMemory<byte> json, string entityTag, WorldDetails? world)
{
    public string MapId { get; } = mapId;

    public IReadOnlyList<MapSpot> Spots { get; } = spots;

    public IReadOnlyList<MapHabitatZone> Habitats { get; } = habitats;

    /// <summary>The map as Tiled JSON (UTF-8).</summary>
    public ReadOnlyMemory<byte> Json { get; } = json;

    public string EntityTag { get; } = entityTag;

    /// <summary>For a generated map, how it was made; <c>null</c> for an authored one.</summary>
    public WorldDetails? World { get; } = world;

    public MapSpot? FindSpot(string spotId) => Spots.FirstOrDefault(spot => spot.SpotId == spotId);

    /// <summary>The ID of the habitat whose zone contains the tile, if any.</summary>
    public string? HabitatAt(int x, int y) => Habitats.FirstOrDefault(zone => zone.Contains(x, y))?.HabitatId;
}
