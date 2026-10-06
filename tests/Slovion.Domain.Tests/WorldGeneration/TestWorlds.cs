using System.Text;
using Slovion.Domain.WorldGeneration;

namespace Slovion.Domain.Tests.WorldGeneration;

/// <summary>A small forest region for generator tests: an authored strip on the left, a generated forest on the right.</summary>
internal static class TestWorlds
{
    public const int Width = 26;
    public const int Height = 20;
    public const int Floor = 14;
    public const int Tree = 26;
    public const int BorderTree = 31;
    public const int StreamTile = 46;
    public const int Garlic = 40;

    public static readonly GridRect Generated = new(8, 0, 18, 20);
    public static readonly GridPoint Connector = new(8, 9);
    public static readonly GridPoint Spawn = new(1, 9);

    public static readonly Biome Forest = new(
        "test_forest",
        Floor: [14, 15, 24],
        PathSet: 80,
        Border: [BorderTree],
        Layers: [new TerrainLayer("forest", 0.55, 4, 2, null)],
        Openings: new Openings(1, 2, 2, 3, [0, 1, 12, 13], 64),
        Water: new Water(WaterKind.Stream, 1.0, 1, [StreamTile], null),
        Decor:
        [
            new DecorRule([Tree, 27], true, 0.6, CellSelector.Parse("layer:forest")!),
            new DecorRule([Tree, 27], true, 0.08, CellSelector.Parse("floor")!),
            new DecorRule([6], false, 0.08, CellSelector.Parse("opening")!),
        ],
        Zones:
        [
            new ZoneRule("clearing", CellSelector.Parse("opening")!, "forest"),
            new ZoneRule("stream", CellSelector.Parse("water")!, "forest"),
            new ZoneRule("stream_bank", CellSelector.Parse("near:water")!, "forest"),
            new ZoneRule("forest_edge", CellSelector.Parse("edge:forest:2")!, "forest"),
            new ZoneRule("dense_forest", CellSelector.Parse("layer:forest")!, "forest"),
            new ZoneRule("forest_floor", CellSelector.Parse("any")!, "forest"),
        ]);

    public static readonly IReadOnlyDictionary<string, Biome> Biomes = new Dictionary<string, Biome> { [Forest.Id] = Forest };

    public static readonly SpeciesRequest[] Species =
    [
        new("cervus_elaphus", new SpeciesPlacement(["forest_edge", "clearing"])),
        new("ursus_arctos", new SpeciesPlacement(["dense_forest", "forest_floor", "forest_edge"])),
        new("salamandra_salamandra", new SpeciesPlacement(["stream_bank", "forest_floor"], WaterNeed.Near)),
        new("allium_ursinum", new SpeciesPlacement(["forest_floor", "stream_bank", "forest_edge"], Tile: Garlic)),
    ];

    /// <summary>The template: the strip is open floor with a path along row 9 to the connector, and three blocking objects.</summary>
    public static MapTemplate Template(IReadOnlyList<GenerationArea>? areas = null)
    {
        var ground = new int[Width * Height];
        var decor = Enumerable.Repeat(-1, Width * Height).ToArray();
        var blocked = new bool[Width * Height];
        for (var y = 0; y < Height; y++)
        {
            for (var x = 0; x < Width; x++)
            {
                var i = (y * Width) + x;
                ground[i] = Floor;
                if (x == 0 || y == 0 || y == Height - 1)
                {
                    decor[i] = BorderTree;
                    blocked[i] = true;
                }
                else if (y == 9 && x < 8)
                {
                    ground[i] = 85;
                }
            }
        }

        return new MapTemplate(
            "test_forest_map",
            Width,
            Height,
            ground,
            decor,
            blocked,
            Enumerable.Range(64, 48).ToHashSet(),
            Spawn,
            [new GridPoint(2, 8), new GridPoint(3, 10), new GridPoint(6, 8)],
            areas ?? [new GenerationArea(Generated, Forest.Id, "test_forest_area", false, Species, [Connector])]);
    }

    public static GeneratedMap Generate(long seed) => WorldGenerator.Generate(Template(), Biomes, seed);

    /// <summary>The map as text: # blocked, ~ water, = path, letters for spots, . open; for test output.</summary>
    public static string Ascii(GeneratedMap map)
    {
        var text = new StringBuilder();
        for (var y = 0; y < map.Height; y++)
        {
            for (var x = 0; x < map.Width; x++)
            {
                var i = (y * map.Width) + x;
                var spot = map.Spots.FirstOrDefault(spot => spot.At == new GridPoint(x, y));
                text.Append(spot is not null ? char.ToUpperInvariant(spot.SpeciesId[0])
                    : map.Ground[i] == StreamTile ? '~'
                    : map.Ground[i] is >= 64 and < 112 ? '='
                    : map.Blocked[i] ? '#'
                    : '.');
            }

            text.AppendLine();
        }

        return text.ToString();
    }

    /// <summary>The cells of <paramref name="rect"/> on the test map.</summary>
    public static IEnumerable<int> Cells(GridRect rect) =>
        from y in Enumerable.Range(rect.Y, rect.Height)
        from x in Enumerable.Range(rect.X, rect.Width)
        select (y * Width) + x;

    /// <summary>The tiles the player reaches from the spawn without tools (blocking objects included).</summary>
    public static bool[] Reach(GeneratedMap map, MapTemplate template)
    {
        var objects = template.BlockingObjects.Select(point => (point.Y * map.Width) + point.X).ToHashSet();
        return GridSearch.Reachable(map.Width, map.Height, (template.Spawn.Y * map.Width) + template.Spawn.X, cell => !map.Blocked[cell] && !objects.Contains(cell));
    }
}
