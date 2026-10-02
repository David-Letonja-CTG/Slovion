using Slovion.Domain.Content;

namespace Slovion.Domain.Discovery;

/// <summary>Where and what the player observed: a species at a fixed spot, or found by searching a habitat.</summary>
public sealed record Sighting
{
    public string MapId { get; }

    /// <summary>The spot, for sightings at a spot; otherwise <c>null</c>.</summary>
    public string? SpotId { get; }

    /// <summary>The searched habitat, for sightings found by searching; otherwise <c>null</c>.</summary>
    public string? HabitatId { get; }

    public SpeciesId SpeciesId { get; }

    private Sighting(string mapId, string? spotId, string? habitatId, SpeciesId speciesId)
    {
        MapId = mapId;
        SpotId = spotId;
        HabitatId = habitatId;
        SpeciesId = speciesId;
    }

    public static Sighting AtSpot(MapSpot spot)
    {
        ArgumentNullException.ThrowIfNull(spot);
        return new Sighting(spot.MapId, spot.SpotId, null, spot.SpeciesId);
    }

    public static Sighting InHabitat(string mapId, string habitatId, SpeciesId speciesId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(mapId);
        ArgumentException.ThrowIfNullOrWhiteSpace(habitatId);
        return new Sighting(mapId, null, habitatId, speciesId);
    }
}
