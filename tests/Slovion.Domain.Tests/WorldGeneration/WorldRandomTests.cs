using Slovion.Domain.WorldGeneration;

namespace Slovion.Domain.Tests.WorldGeneration;

public class WorldRandomTests
{
    [Fact]
    public void A_seed_always_gives_the_same_sequence()
    {
        var first = new WorldRandom(482913);
        var second = new WorldRandom(482913);

        Assert.Equal(Enumerable.Range(0, 100).Select(_ => first.NextUInt64()), Enumerable.Range(0, 100).Select(_ => second.NextUInt64()));
    }

    [Fact]
    public void The_sequence_is_fixed_across_machines_and_versions()
    {
        // SplitMix64 reference values for seed 0 (published test vectors).
        var random = new WorldRandom(0);

        Assert.Equal(0xE220A8397B1DCDAFUL, random.NextUInt64());
        Assert.Equal(0x6E789E6AA1B965F4UL, random.NextUInt64());
    }

    [Fact]
    public void Forks_depend_on_the_seed_and_name_not_on_how_much_was_drawn()
    {
        var a = new WorldRandom(7);
        var b = new WorldRandom(7);
        a.NextUInt64();

        Assert.Equal(a.Fork("paths").NextUInt64(), b.Fork("paths").NextUInt64());
        Assert.NotEqual(a.Fork("paths").NextUInt64(), a.Fork("decor").NextUInt64());
    }

    [Fact]
    public void Ranges_and_picks_stay_in_bounds_and_cover_them()
    {
        var random = new WorldRandom(1);
        var seen = new HashSet<int>();
        for (var i = 0; i < 1000; i++)
        {
            var value = random.Range(3, 7);
            Assert.InRange(value, 3, 7);
            seen.Add(value);
            Assert.InRange(random.NextDouble(), 0, 1);
        }

        Assert.Equal(5, seen.Count);
    }

    [Fact]
    public void Fnv1a_matches_the_reference()
    {
        Assert.Equal(0xcbf29ce484222325UL, SeedHash.Of(string.Empty));
        Assert.Equal(0xaf63dc4c8601ec8cUL, SeedHash.Of("a"));
    }

    [Theory]
    [InlineData("any", SelectorKind.Any, null, 1)]
    [InlineData("layer:forest", SelectorKind.Layer, "forest", 1)]
    [InlineData("edge:forest:2", SelectorKind.Edge, "forest", 2)]
    [InlineData("near:water:3", SelectorKind.NearWater, null, 3)]
    public void Selectors_parse(string text, SelectorKind kind, string? layer, int distance)
    {
        Assert.Equal(new CellSelector(kind, layer, distance), CellSelector.Parse(text));
    }

    [Theory]
    [InlineData("")]
    [InlineData("layer")]
    [InlineData("edge:forest:0")]
    [InlineData("near:land")]
    public void Invalid_selectors_are_rejected(string text)
    {
        Assert.Null(CellSelector.Parse(text));
    }
}
