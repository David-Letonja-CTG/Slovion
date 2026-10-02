using Slovion.Domain.Content;

namespace Slovion.Domain.Discovery;

/// <summary>
/// A save slot's NatureDex record of one species: first observed at a spot, and later identified
/// once the player answered an encounter correctly (docs/decisions.md D1). One per species and slot.
/// </summary>
public sealed class SpeciesDiscovery
{
    public Guid SaveSlotId { get; private set; }

    public SpeciesId SpeciesId { get; private set; }

    /// <summary>Where the species was first observed.</summary>
    public string MapId { get; private set; }

    /// <summary>The spot of the first observation, or <c>null</c> if it was found by searching a habitat.</summary>
    public string? SpotId { get; private set; }

    /// <summary>The habitat searched at the first observation, or <c>null</c> if it was seen at a spot.</summary>
    public string? HabitatId { get; private set; }

    public DateTimeOffset ObservedAt { get; private set; }

    public DateTimeOffset? IdentifiedAt { get; private set; }

    public bool IsIdentified => IdentifiedAt is not null;

    private SpeciesDiscovery(Guid saveSlotId, SpeciesId speciesId, string mapId, string? spotId, string? habitatId, DateTimeOffset observedAt)
    {
        SaveSlotId = saveSlotId;
        SpeciesId = speciesId;
        MapId = mapId;
        SpotId = spotId;
        HabitatId = habitatId;
        ObservedAt = observedAt;
    }

    public static SpeciesDiscovery Observe(Guid saveSlotId, Sighting sighting, DateTimeOffset observedAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(saveSlotId, Guid.Empty);
        ArgumentNullException.ThrowIfNull(sighting);
        return new SpeciesDiscovery(saveSlotId, sighting.SpeciesId, sighting.MapId, sighting.SpotId, sighting.HabitatId, observedAt);
    }

    /// <summary>Marks the species identified. Identifying again keeps the first identification time.</summary>
    public void Identify(DateTimeOffset identifiedAt) => IdentifiedAt ??= identifiedAt;
}
