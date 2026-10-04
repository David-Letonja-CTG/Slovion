using Slovion.Domain.Content;

namespace Slovion.Domain.Tests.Content;

public class StationTests
{
    private static readonly SpeciesId Fir = SpeciesId.Parse("abies_alba");
    private static readonly SpeciesId Beech = SpeciesId.Parse("fagus_sylvatica");
    private static readonly SpeciesId Spruce = SpeciesId.Parse("picea_abies");
    private static readonly Station Forest = new("forest_station", "kocevje_forest", [Fir, Beech, Spruce], 2, new Dictionary<string, StationText>());

    [Fact]
    public void Only_fully_researched_listed_species_count()
    {
        var levels = new Dictionary<SpeciesId, int> { [Fir] = 3, [Beech] = 2, [SpeciesId.Parse("salvia_pratensis")] = 3 };

        Assert.Equal(1, Forest.ResearchedCount(levels));
        Assert.False(Forest.IsMetBy(levels));
    }

    [Fact]
    public void The_goal_is_met_once_enough_species_are_fully_researched()
    {
        Assert.True(Forest.IsMetBy(new Dictionary<SpeciesId, int> { [Fir] = 3, [Spruce] = 3 }));
        Assert.True(Forest.IsMetBy(new Dictionary<SpeciesId, int> { [Fir] = 3, [Beech] = 3, [Spruce] = 3 }));
    }

    [Fact]
    public void A_new_save_has_nothing_researched()
    {
        Assert.Equal(0, Forest.ResearchedCount(new Dictionary<SpeciesId, int>()));
    }
}
