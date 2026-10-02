using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Domain.Tests.Discovery;

public class SightingTests
{
    private static readonly SpeciesId Hare = SpeciesId.Parse("lepus_europaeus");

    [Fact]
    public void A_spot_sighting_has_a_spot_and_no_habitat()
    {
        var sighting = Sighting.AtSpot(new MapSpot("dravsko_polje_meadow", "meadow_hare_1", Hare));

        Assert.Equal(("dravsko_polje_meadow", "meadow_hare_1", null), (sighting.MapId, sighting.SpotId, sighting.HabitatId));
        Assert.Equal(Hare, sighting.SpeciesId);
    }

    [Fact]
    public void A_habitat_sighting_has_a_habitat_and_no_spot()
    {
        var sighting = Sighting.InHabitat("dravsko_polje_meadow", "tall_grass", Hare);

        Assert.Equal(("dravsko_polje_meadow", null, "tall_grass"), (sighting.MapId, sighting.SpotId, sighting.HabitatId));
    }

    [Fact]
    public void A_habitat_sighting_needs_a_map_and_habitat()
    {
        Assert.Throws<ArgumentException>(() => Sighting.InHabitat("", "tall_grass", Hare));
        Assert.Throws<ArgumentException>(() => Sighting.InHabitat("dravsko_polje_meadow", " ", Hare));
    }

    [Fact]
    public void Observations_and_encounters_keep_where_they_happened()
    {
        var inGrass = Sighting.InHabitat("dravsko_polje_meadow", "tall_grass", Hare);

        var observation = SpeciesDiscovery.Observe(Guid.NewGuid(), inGrass, DateTimeOffset.UnixEpoch);
        var encounter = Encounter.Start(Guid.NewGuid(), Guid.NewGuid(), inGrass, [Hare, SpeciesId.Parse("alauda_arvensis")], DateTimeOffset.UnixEpoch);

        Assert.Equal((null, "tall_grass"), (observation.SpotId, observation.HabitatId));
        Assert.Equal((null, "tall_grass"), (encounter.SpotId, encounter.HabitatId));
    }
}
