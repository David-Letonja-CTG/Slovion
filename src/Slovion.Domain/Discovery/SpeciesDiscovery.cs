using Slovion.Domain.Content;

namespace Slovion.Domain.Discovery;

/// <summary>A save slot has discovered a species at a spot. Each species is discovered once per slot.</summary>
public sealed class SpeciesDiscovery
{
    private SpeciesDiscovery(Guid saveSlotId, SpeciesId speciesId, string mapId, string spotId, DateTimeOffset discoveredAt)
    {
        SaveSlotId = saveSlotId;
        SpeciesId = speciesId;
        MapId = mapId;
        SpotId = spotId;
        DiscoveredAt = discoveredAt;
    }

    public Guid SaveSlotId { get; private set; }

    public SpeciesId SpeciesId { get; private set; }

    public string MapId { get; private set; }

    public string SpotId { get; private set; }

    public DateTimeOffset DiscoveredAt { get; private set; }

    public static SpeciesDiscovery Record(Guid saveSlotId, MapSpot spot, DateTimeOffset discoveredAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(saveSlotId, Guid.Empty);
        ArgumentNullException.ThrowIfNull(spot);
        return new SpeciesDiscovery(saveSlotId, spot.SpeciesId, spot.MapId, spot.SpotId, discoveredAt);
    }
}
