using Slovion.Domain.Content;

namespace Slovion.Domain.Discovery;

/// <summary>
/// A save slot's NatureDex record of one species: first observed at a spot, and later identified
/// once the player answered an encounter correctly (docs/decisions.md D1). One per species and slot.
/// </summary>
public sealed class SpeciesDiscovery
{
    private SpeciesDiscovery(Guid saveSlotId, SpeciesId speciesId, string mapId, string spotId, DateTimeOffset observedAt)
    {
        SaveSlotId = saveSlotId;
        SpeciesId = speciesId;
        MapId = mapId;
        SpotId = spotId;
        ObservedAt = observedAt;
    }

    public Guid SaveSlotId { get; private set; }

    public SpeciesId SpeciesId { get; private set; }

    /// <summary>Where the species was first observed.</summary>
    public string MapId { get; private set; }

    public string SpotId { get; private set; }

    public DateTimeOffset ObservedAt { get; private set; }

    public DateTimeOffset? IdentifiedAt { get; private set; }

    public bool IsIdentified => IdentifiedAt is not null;

    public static SpeciesDiscovery Observe(Guid saveSlotId, MapSpot spot, DateTimeOffset observedAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(saveSlotId, Guid.Empty);
        ArgumentNullException.ThrowIfNull(spot);
        return new SpeciesDiscovery(saveSlotId, spot.SpeciesId, spot.MapId, spot.SpotId, observedAt);
    }

    /// <summary>Marks the species identified. Identifying again keeps the first identification time.</summary>
    public void Identify(DateTimeOffset identifiedAt) => IdentifiedAt ??= identifiedAt;
}
