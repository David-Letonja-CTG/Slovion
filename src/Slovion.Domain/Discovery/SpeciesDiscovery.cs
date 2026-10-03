using Slovion.Domain.Content;
using Slovion.Domain.World;

namespace Slovion.Domain.Discovery;

/// <summary>
/// A save slot's NatureDex record of one species: first observed at a spot, and later identified
/// once the player answered an encounter correctly (docs/decisions.md D1), then researched further by sighting it again.
/// One per species and slot.
/// </summary>
public sealed class SpeciesDiscovery
{
    /// <summary>The highest research level; identifying a species gives level 1.</summary>
    public const int MaxResearchLevel = 3;

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

    /// <summary>0 until identified, then 1 to <see cref="MaxResearchLevel"/>.</summary>
    public int ResearchLevel { get; private set; }

    /// <summary>When the research level last rose (the identification counts as the first step).</summary>
    public DateTimeOffset? ResearchedAt { get; private set; }

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

    /// <summary>Marks the species identified at research level 1. Identifying again keeps the first identification.</summary>
    public void Identify(DateTimeOffset identifiedAt)
    {
        if (IdentifiedAt is not null)
        {
            return;
        }

        IdentifiedAt = identifiedAt;
        ResearchLevel = 1;
        ResearchedAt = identifiedAt;
    }

    /// <summary>
    /// A sighting of the identified species at real time <paramref name="at"/>: raises the research level when the in-game
    /// day or time of day (D8) differs from the last research step's, up to <see cref="MaxResearchLevel"/>.
    /// Returns whether the level rose.
    /// </summary>
    public bool Research(DateTimeOffset at, DateTimeOffset saveCreatedAt)
    {
        if (!IsIdentified || ResearchLevel >= MaxResearchLevel)
        {
            return false;
        }

        var now = WorldTime.Since(saveCreatedAt, at);
        var last = WorldTime.Since(saveCreatedAt, ResearchedAt ?? IdentifiedAt!.Value);
        if (now.Day == last.Day && now.TimeOfDay == last.TimeOfDay)
        {
            return false;
        }

        ResearchLevel++;
        ResearchedAt = at;
        return true;
    }
}
