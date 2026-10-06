using Slovion.Domain.WorldGeneration;
using static Slovion.Domain.Tests.WorldGeneration.TestWorlds;

namespace Slovion.Domain.Tests.WorldGeneration;

public class WorldGeneratorTests
{
    private const int Seeds = 500;

    [Fact]
    public void The_same_inputs_give_the_same_map()
    {
        var first = Generate(482913);
        var second = Generate(482913);

        Assert.Equal(first.Ground, second.Ground);
        Assert.Equal(first.Decor, second.Decor);
        Assert.Equal(first.Blocked, second.Blocked);
        Assert.Equal(first.Spots, second.Spots);
        Assert.Equal(first.HabitatZones, second.HabitatZones);
        TestContext.Current.TestOutputHelper?.WriteLine(Ascii(first));
    }

    [Fact]
    public void Different_seeds_give_visibly_different_maps()
    {
        for (long seed = 1; seed <= 20; seed++)
        {
            var a = Generate(seed);
            var b = Generate(seed + 1000);
            var cells = Cells(Generated).ToList();
            var differing = cells.Count(i => a.Ground[i] != b.Ground[i] || a.Decor[i] != b.Decor[i] || a.Blocked[i] != b.Blocked[i]);

            Assert.True(differing >= cells.Count / 4, $"seeds {seed} and {seed + 1000} differ in only {differing} of {cells.Count} cells");
        }
    }

    [Fact]
    public void The_authored_strip_never_changes()
    {
        var template = Template();
        for (long seed = 0; seed < 50; seed++)
        {
            var map = Generate(seed);
            foreach (var i in Enumerable.Range(0, Width * Height).Where(i => !Generated.Contains(i % Width, i / Width)))
            {
                Assert.Equal(template.Ground[i], map.Ground[i]);
                Assert.Equal(template.Decor[i], map.Decor[i]);
                Assert.Equal(template.Blocked[i], map.Blocked[i]);
            }
        }
    }

    [Fact]
    public void Every_map_is_playable_and_rarely_needs_the_fallback()
    {
        var template = Template();
        var repaired = 0;
        for (long seed = 0; seed < Seeds; seed++)
        {
            var map = Generate(seed);
            var reach = Reach(map, template);
            repaired += map.Repaired ? 1 : 0;

            Assert.True(reach[(Connector.Y * Width) + Connector.X], $"seed {seed}: connector unreachable\n{Ascii(map)}");
            Assert.Equal(Species.Length, map.Spots.Count);
            foreach (var spot in map.Spots)
            {
                var cell = (spot.At.Y * Width) + spot.At.X;
                var reachable = map.Blocked[cell]
                    ? GridSearch.Neighbours(cell, Width, Height).Any(next => reach[next])
                    : reach[cell];
                Assert.True(reachable, $"seed {seed}: {spot.SpeciesId} unreachable\n{Ascii(map)}");
            }

            var cutOff = Cells(Generated).Where(i => !map.Blocked[i] && !reach[i]).ToList();
            Assert.True(cutOff.Count == 0, $"seed {seed}: {cutOff.Count} walkable tiles cut off\n{Ascii(map)}");
        }

        Assert.True(repaired < Seeds / 100, $"{repaired} of {Seeds} maps needed the fallback");
    }

    [Fact]
    public void Spots_zones_and_objects_stay_inside_the_generated_area()
    {
        for (long seed = 0; seed < 100; seed++)
        {
            var map = Generate(seed);

            Assert.All(map.Spots, spot => Assert.True(Generated.Contains(spot.At)));
            Assert.All(map.HabitatZones, zone => Assert.True(Generated.Contains(zone.Rect.X, zone.Rect.Y) && Generated.Contains(zone.Rect.Right, zone.Rect.Bottom)));
            for (var i = 0; i < map.HabitatZones.Count; i++)
            {
                for (var j = i + 1; j < map.HabitatZones.Count; j++)
                {
                    var a = map.HabitatZones[i].Rect;
                    var b = map.HabitatZones[j].Rect;
                    Assert.False(a.X <= b.Right && b.X <= a.Right && a.Y <= b.Bottom && b.Y <= a.Bottom, $"seed {seed}: zones {a} and {b} overlap");
                }
            }
        }
    }

    [Fact]
    public void Paths_and_the_border_belong_to_no_habitat_and_every_other_tile_does()
    {
        var map = Generate(7);
        foreach (var i in Cells(Generated))
        {
            var x = i % Width;
            var y = i / Width;
            var inZone = map.HabitatZones.Any(zone => zone.Rect.Contains(x, y));
            var pathOrBorder = map.Ground[i] is >= 64 and < 112 || x == Width - 1 || y == 0 || y == Height - 1;
            Assert.Equal(!pathOrBorder, inZone);
        }
    }

    [Fact]
    public void A_forest_grows_in_coherent_stands_not_noise()
    {
        double coherent = 0;
        for (long seed = 0; seed < Seeds; seed++)
        {
            var map = Generate(seed);
            var dense = Cells(Generated).Where(i => map.ZoneKinds[i] == "dense_forest").ToList();
            var forested = (int i) => map.ZoneKinds[i] is "dense_forest" or "forest_edge";
            coherent += dense.Count == 0 ? 1 : dense.Count(i => GridSearch.Neighbours(i, Width, Height).Count(forested) >= 2) / (double)dense.Count;
        }

        Assert.True(coherent / Seeds >= 0.85, $"only {coherent / Seeds:P0} of the dense forest is coherent");
    }

    [Fact]
    public void Species_are_placed_only_where_their_data_allows_preferring_their_first_choice()
    {
        var edge = 0;
        var clearing = 0;
        for (long seed = 0; seed < Seeds; seed++)
        {
            var map = Generate(seed);
            foreach (var spot in map.Spots)
            {
                var kind = map.ZoneKinds[(spot.At.Y * Width) + spot.At.X];
                var allowed = Species.Single(request => request.SpeciesId == spot.SpeciesId).Placement.Zones;
                Assert.Contains(kind, allowed);
            }

            var deer = map.Spots.Single(spot => spot.SpeciesId == "cervus_elaphus");
            var deerKind = map.ZoneKinds[(deer.At.Y * Width) + deer.At.X];
            edge += deerKind == "forest_edge" ? 1 : 0;
            clearing += deerKind == "clearing" ? 1 : 0;
        }

        Assert.True(edge > clearing, $"forest edge {edge}, clearing {clearing}");
    }

    [Fact]
    public void A_plant_is_drawn_at_its_spot_and_a_species_that_needs_water_lives_near_it()
    {
        for (long seed = 0; seed < 100; seed++)
        {
            var map = Generate(seed);
            var garlic = map.Spots.Single(spot => spot.SpeciesId == "allium_ursinum").At;
            Assert.Equal(Garlic, map.Decor[(garlic.Y * Width) + garlic.X]);

            var salamander = map.Spots.Single(spot => spot.SpeciesId == "salamandra_salamandra").At;
            var nearWater = Cells(Generated).Any(i => map.Ground[i] == StreamTile
                && Math.Abs((i % Width) - salamander.X) + Math.Abs((i / Width) - salamander.Y) <= 3);
            Assert.True(nearWater, $"seed {seed}: the salamander is not near water\n{Ascii(map)}");
        }
    }

    [Fact]
    public void A_stream_crosses_the_area_and_a_ford_crosses_the_stream()
    {
        for (long seed = 0; seed < 100; seed++)
        {
            var map = Generate(seed);
            var rowsWithWaterOrFord = Enumerable.Range(Generated.Y + 1, Generated.Height - 2)
                .Count(y => Enumerable.Range(Generated.X, Generated.Width).Any(x => map.Ground[(y * Width) + x] == StreamTile));

            // Every inner row has water, except the rows a ford (a path tile) crosses.
            Assert.True(rowsWithWaterOrFord >= Generated.Height - 2 - 3, $"seed {seed}\n{Ascii(map)}");
        }
    }

    [Fact]
    public void Path_tiles_match_their_neighbours()
    {
        var map = Generate(42);
        var isPath = (int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height && map.Ground[(y * Width) + x] is >= 64 and < 112;
        foreach (var i in Cells(Generated).Where(i => isPath(i % Width, i / Width)))
        {
            var x = i % Width;
            var y = i / Width;
            var mask = (map.Ground[i] - 64) % 16;
            Assert.Equal(isPath(x, y - 1), (mask & 1) == 0);
            Assert.Equal(isPath(x + 1, y), (mask & 2) == 0);
            Assert.Equal(isPath(x, y + 1), (mask & 4) == 0);
            Assert.Equal(isPath(x - 1, y), (mask & 8) == 0);
        }
    }

    [Fact]
    public void A_species_that_fits_nowhere_fails_loudly()
    {
        var impossible = new SpeciesRequest("proteus_anguinus", new SpeciesPlacement(["cave_water"]));
        var template = Template([new GenerationArea(Generated, Forest.Id, "test_forest_area", false, [impossible], [Connector])]);

        var error = Assert.Throws<InvalidOperationException>(() => WorldGenerator.Generate(template, Biomes, 1));
        Assert.Contains("proteus_anguinus", error.Message, StringComparison.Ordinal);
    }

    private static IEnumerable<int> Cells(GridRect rect) =>
        from y in Enumerable.Range(rect.Y, rect.Height)
        from x in Enumerable.Range(rect.X, rect.Width)
        select (y * Width) + x;
}
