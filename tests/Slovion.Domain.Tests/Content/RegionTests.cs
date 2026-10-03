using Slovion.Domain.Content;

namespace Slovion.Domain.Tests.Content;

public class RegionTests
{
    private static readonly string[] NoFlags = [];

    [Fact]
    public void An_always_open_region_is_unlocked_for_a_new_save()
    {
        Assert.True(RegionWith(new UnlockRule.Always()).IsUnlockedFor(NoFlags, 0));
    }

    [Fact]
    public void A_flag_region_opens_with_its_flag()
    {
        var region = RegionWith(new UnlockRule.Flag("hedgerow_open"));

        Assert.False(region.IsUnlockedFor(NoFlags, 10));
        Assert.False(region.IsUnlockedFor(["other"], 0));
        Assert.True(region.IsUnlockedFor(["hedgerow_open"], 0));
    }

    [Fact]
    public void A_count_region_opens_at_its_count()
    {
        var region = RegionWith(new UnlockRule.IdentifiedSpecies(6));

        Assert.False(region.IsUnlockedFor(NoFlags, 5));
        Assert.True(region.IsUnlockedFor(NoFlags, 6));
        Assert.True(region.IsUnlockedFor(NoFlags, 7));
    }

    private static Region RegionWith(UnlockRule rule) =>
        new("kocevje", "kocevje_forest", 2, 50, 50, rule, new Dictionary<string, RegionText> { ["sl"] = new("Kočevje", "Namig") });
}
