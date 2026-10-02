using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Domain.Tests.Discovery;

public class SpeciesDiscoveryTests
{
    private static readonly MapSpot Sage = new("dravsko_polje_meadow", "meadow_sage_1", SpeciesId.Parse("salvia_pratensis"));
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Records_the_observed_species_of_the_spot_for_one_save_slot()
    {
        var slot = Guid.NewGuid();

        var discovery = SpeciesDiscovery.Observe(slot, Sighting.AtSpot(Sage), June1);

        Assert.Equal(slot, discovery.SaveSlotId);
        Assert.Equal(Sage.SpeciesId, discovery.SpeciesId);
        Assert.Equal(("dravsko_polje_meadow", "meadow_sage_1"), (discovery.MapId, discovery.SpotId));
        Assert.Equal(June1, discovery.ObservedAt);
        Assert.False(discovery.IsIdentified);
    }

    [Fact]
    public void Identifying_keeps_the_first_identification_time()
    {
        var discovery = SpeciesDiscovery.Observe(Guid.NewGuid(), Sighting.AtSpot(Sage), June1);

        discovery.Identify(June1.AddHours(1));
        discovery.Identify(June1.AddHours(5));

        Assert.True(discovery.IsIdentified);
        Assert.Equal(June1.AddHours(1), discovery.IdentifiedAt);
    }

    [Fact]
    public void Requires_a_save_slot()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SpeciesDiscovery.Observe(Guid.Empty, Sighting.AtSpot(Sage), June1));
    }
}
