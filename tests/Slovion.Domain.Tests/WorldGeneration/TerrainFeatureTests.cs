using Slovion.Domain.WorldGeneration;
using static Slovion.Domain.Tests.WorldGeneration.TestWorlds;

namespace Slovion.Domain.Tests.WorldGeneration;

/// <summary>Biased and blocking layers, shores with shallows, wading spots and biomes without path tiles (design §5–§7).</summary>
public class TerrainFeatureTests
{
    private const int Seeds = 200;
    private const int Meadow = 51;
    private const int Reeds = 50;
    private const int Deep = 48;
    private const int Shallow = 46;
    private const int Lily = 54;
    private const int Snow = 34;
    private const int CaveFloor = 113;
    private const int CaveRock = 114;

    private static readonly Biome Lake = new(
        "test_lake",
        Floor: [Meadow],
        PathSet: 64,
        Border: [BorderTree],
        Layers: [new TerrainLayer("reeds", 0.1, 3, 1, [Reeds], Blocking: true, Bias: Edge.South, BiasStrength: 0.8)],
        Openings: new Openings(1, 1, 2, 2, [0, 1], 64),
        Water: new Water(WaterKind.Shore, 1.0, 3, [Deep], [55], Edge.South, [Shallow], 2),
        Decor: [],
        Zones:
        [
            new ZoneRule("open_water", CellSelector.Parse("water")!, "lake"),
            new ZoneRule("shore", CellSelector.Parse("near:water:2")!, "lake"),
            new ZoneRule("meadow", CellSelector.Parse("any")!, "lake"),
        ]);

    private static readonly Biome Peaks = new(
        "test_peaks",
        Floor: [22],
        PathSet: 96,
        Border: [37],
        Layers: [new TerrainLayer("snow", 0.2, 4, 1, [Snow], Bias: Edge.North, BiasStrength: 1)],
        Openings: null,
        Water: null,
        Decor: [],
        Zones: [new ZoneRule("grassland", CellSelector.Parse("any")!, "peaks")]);

    private static readonly Biome Cave = new(
        "test_cave",
        Floor: [CaveFloor],
        PathSet: null,
        Border: [CaveRock],
        Layers: [new TerrainLayer("rock", 0.4, 3, 2, [CaveRock], Blocking: true)],
        Openings: new Openings(1, 2, 2, 2, [CaveFloor], null),
        Water: null,
        Decor: [],
        Zones: [new ZoneRule("cave_floor", CellSelector.Parse("any")!, null)]);

    private static readonly SpeciesRequest[] LakeSpecies =
    [
        new("nymphaea_alba", new SpeciesPlacement(["open_water"], WaterNeed.Wade, Tile: Lily, Blocking: true)),
        new("ardea_cinerea", new SpeciesPlacement(["shore"], WaterNeed.Near)),
    ];

    [Fact]
    public void A_shore_runs_along_its_edge_with_shallows_towards_the_land()
    {
        for (long seed = 0; seed < Seeds; seed++)
        {
            var map = GenerateWith(Lake, LakeSpecies, seed);

            for (var x = Generated.X; x <= Generated.Right; x++)
            {
                // Water rises unbroken from the map's edge, 4 to 6 rows deep (3 deep + 2 shallow, ± 1).
                var depth = Enumerable.Range(0, Height).TakeWhile(k => map.Ground[Index(x, Height - 1 - k)] is Deep or Shallow).Count();
                Assert.True(depth is >= 4 and <= 6, $"seed {seed}, column {x}: {depth} rows of water ({string.Join(" ", Enumerable.Range(0, Height).Select(y => map.Ground[Index(x, y)]))})");
                Assert.DoesNotContain(Enumerable.Range(0, Height - depth), y => map.Ground[Index(x, y)] is Deep or Shallow);

                var landward = map.Ground[Index(x, Height - depth)];
                Assert.Equal(x == Width - 1 ? Deep : Shallow, landward);
                Assert.Equal(Deep, map.Ground[Index(x, Height - 1)]);
            }
        }
    }

    [Fact]
    public void A_wading_spot_lies_in_the_shallows_away_from_the_shore()
    {
        for (long seed = 0; seed < Seeds; seed++)
        {
            var template = LakeTemplate();
            var map = WorldGenerator.Generate(template, Biomes(Lake), seed);
            var lily = map.Spots.Single(spot => spot.SpeciesId == "nymphaea_alba").At;
            var cell = Index(lily.X, lily.Y);
            var walking = Reach(map, template);
            var wading = GridSearch.Reachable(map.Width, map.Height, Index(Spawn.X, Spawn.Y), next => walking[next] || map.Ground[next] == Shallow);

            Assert.Equal((Shallow, Lily), (map.Ground[cell], map.Decor[cell]));
            Assert.DoesNotContain(GridSearch.Neighbours(cell, Width, Height), next => walking[next]);
            Assert.True(wading[cell], $"seed {seed}: the lily at ({lily.X}, {lily.Y}) cannot be reached by wading");
        }
    }

    [Fact]
    public void A_biased_layer_gathers_towards_its_edge()
    {
        int north = 0, south = 0;
        for (long seed = 0; seed < 50; seed++)
        {
            var map = GenerateWith(Peaks, [], seed);
            north += Cells(Generated).Count(cell => cell / Width < 7 && map.Ground[cell] == Snow);
            south += Cells(Generated).Count(cell => cell / Width >= 13 && map.Ground[cell] == Snow);
        }

        Assert.True(north > 10 * Math.Max(1, south), $"snow: {north} tiles in the north third, {south} in the south third");
    }

    [Fact]
    public void A_blocking_layer_blocks_and_a_biome_without_path_tiles_keeps_its_floor()
    {
        for (long seed = 0; seed < Seeds; seed++)
        {
            var template = Template([new GenerationArea(Generated, Cave.Id, "test_cave_area", true, [], [Connector])]);
            var map = WorldGenerator.Generate(template, Biomes(Cave), seed);
            var reach = Reach(map, template);

            Assert.All(Cells(Generated), cell => Assert.True(map.Ground[cell] is CaveFloor or CaveRock, $"seed {seed}: tile {map.Ground[cell]} at {cell}"));
            Assert.All(Cells(Generated).Where(cell => map.Ground[cell] == CaveRock), cell => Assert.True(map.Blocked[cell]));
            Assert.All(Cells(Generated).Where(cell => !map.Blocked[cell]), cell => Assert.True(reach[cell], $"seed {seed}: cave floor at {cell} cut off"));
            Assert.True(reach[Index(Connector.X, Connector.Y)]);
        }
    }

    private static MapTemplate LakeTemplate() =>
        Template([new GenerationArea(Generated, Lake.Id, "test_lake_area", false, LakeSpecies, [Connector])]) with { WadeableTiles = new HashSet<int> { Shallow } };

    private static GeneratedMap GenerateWith(Biome biome, SpeciesRequest[] species, long seed) =>
        WorldGenerator.Generate(Template([new GenerationArea(Generated, biome.Id, "test_area", false, species, [Connector])]) with { WadeableTiles = new HashSet<int> { Shallow } }, Biomes(biome), seed);

    private static Dictionary<string, Biome> Biomes(Biome biome) => new() { [biome.Id] = biome };

    private static int Index(int x, int y) => (y * Width) + x;
}
