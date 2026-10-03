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

    // A save created at June1 starts at 08:00 on day 1 (morning); one real second is one in-game minute (D8).
    private static readonly DateTimeOffset SameMorning = June1.AddSeconds(90); // 09:30
    private static readonly DateTimeOffset Evening = June1.AddSeconds(600); // 18:00
    private static readonly DateTimeOffset NextMorning = June1.AddSeconds(24 * 60); // day 2, 08:00

    private static SpeciesDiscovery IdentifiedSage()
    {
        var discovery = SpeciesDiscovery.Observe(Guid.NewGuid(), Sighting.AtSpot(Sage), June1);
        discovery.Identify(June1);
        return discovery;
    }

    [Fact]
    public void Identifying_starts_research_at_level_1()
    {
        var discovery = SpeciesDiscovery.Observe(Guid.NewGuid(), Sighting.AtSpot(Sage), June1);
        Assert.Equal(0, discovery.ResearchLevel);

        discovery.Identify(June1);

        Assert.Equal((1, June1), (discovery.ResearchLevel, discovery.ResearchedAt));
    }

    [Fact]
    public void Sighting_again_at_the_same_time_of_day_does_not_research()
    {
        var discovery = IdentifiedSage();

        Assert.False(discovery.Research(SameMorning, June1));
        Assert.Equal((1, June1), (discovery.ResearchLevel, discovery.ResearchedAt));
    }

    [Fact]
    public void Sighting_again_at_another_time_of_day_or_day_researches_up_to_level_3()
    {
        var discovery = IdentifiedSage();

        Assert.True(discovery.Research(Evening, June1));
        Assert.Equal((2, Evening), (discovery.ResearchLevel, discovery.ResearchedAt));
        Assert.True(discovery.Research(NextMorning, June1));
        Assert.Equal(3, discovery.ResearchLevel);
        Assert.False(discovery.Research(NextMorning.AddDays(1), June1));
        Assert.Equal(SpeciesDiscovery.MaxResearchLevel, discovery.ResearchLevel);
    }

    [Fact]
    public void Unidentified_species_are_not_researched()
    {
        var discovery = SpeciesDiscovery.Observe(Guid.NewGuid(), Sighting.AtSpot(Sage), June1);

        Assert.False(discovery.Research(Evening, June1));
        Assert.Equal(0, discovery.ResearchLevel);
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
