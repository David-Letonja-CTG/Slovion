using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Domain.Tests.Discovery;

public class SpeciesDiscoveryTests
{
    private static readonly MapSpot Sage = new("dravsko_polje_meadow", "meadow_sage_1", SpeciesId.Parse("salvia_pratensis"));

    [Fact]
    public void Records_the_species_of_the_spot_for_one_save_slot()
    {
        var slot = Guid.NewGuid();
        var at = new DateTimeOffset(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

        var discovery = SpeciesDiscovery.Record(slot, Sage, at);

        Assert.Equal(slot, discovery.SaveSlotId);
        Assert.Equal(Sage.SpeciesId, discovery.SpeciesId);
        Assert.Equal(("dravsko_polje_meadow", "meadow_sage_1"), (discovery.MapId, discovery.SpotId));
        Assert.Equal(at, discovery.DiscoveredAt);
    }

    [Fact]
    public void Requires_a_save_slot()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => SpeciesDiscovery.Record(Guid.Empty, Sage, DateTimeOffset.UnixEpoch));
    }
}
