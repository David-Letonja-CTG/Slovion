using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Saves;
using Slovion.Domain.Saves;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Content;

namespace Slovion.IntegrationTests.Content;

/// <summary>The repository's templates and biomes (D13): every seed gives a valid map with every listed species.</summary>
public sealed class WorldGenerationContentTests
{
    private const int Seeds = 300;
    private const int TileSize = 16;

    /// <summary>Tiles of the tileset: the cave pool and the lake's wadeable shallows.</summary>
    private const int CavePool = 116;
    private const int Shallows = 46;

    [Theory]
    [InlineData("dravsko_polje_meadow", new[] { "alauda_arvensis", "papilio_machaon", "salvia_pratensis", "taraxacum_officinale", "lepus_europaeus", "lanius_collurio", "crataegus_monogyna" })]
    [InlineData("kocevje_forest", new[] { "ursus_arctos", "cervus_elaphus", "salamandra_salamandra", "allium_ursinum", "galium_odoratum" })]
    [InlineData("pohorje_forest", new[] { "canis_lupus", "sciurus_vulgaris", "drosera_rotundifolia", "vaccinium_myrtillus" })]
    [InlineData("triglav_alps", new[] { "rupicapra_rupicapra", "leontopodium_nivale", "potentilla_nitida", "marmota_marmota", "salamandra_atra" })]
    [InlineData("cerknica_lake", new[] { "ardea_cinerea", "hyla_arborea", "crex_crex", "calopteryx_splendens", "iris_pseudacorus", "iris_sibirica", "nymphaea_alba" })]
    [InlineData("rakov_skocjan_karst", new[] { "saxifraga_rotundifolia", "chrysosplenium_alternifolium", "leptodirus_hochenwartii", "rhinolophus_ferrumequinum", "proteus_anguinus" })]
    public void Every_seed_gives_a_valid_map_with_one_spot_per_species(string mapId, string[] species)
    {
        var maps = new WorldMaps(FileContentCatalog.Load(ContentFolder.RepositoryContent()));
        for (long seed = 0; seed < Seeds; seed++)
        {
            // Generation validates every map (reachability, zones, areas) and throws on an invalid one.
            var map = maps.Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, seed), mapId)!;

            Assert.Equal(species.Order(StringComparer.Ordinal), map.Spots.Select(spot => spot.SpeciesId.Value).Order(StringComparer.Ordinal));
            Assert.All(map.Spots, spot => Assert.Equal($"{mapId}_{spot.SpeciesId.Value}_1", spot.SpotId));
            Assert.NotEmpty(map.Habitats);
            Assert.Equal(seed, map.World?.Seed);
        }
    }

    [Fact]
    public void The_meadow_keeps_the_sage_near_the_spawn_and_the_hedgerow_behind_vera_s_gate()
    {
        var maps = new WorldMaps(FileContentCatalog.Load(ContentFolder.RepositoryContent()));
        var gateColumns = new HashSet<int>();
        for (long seed = 0; seed < 50; seed++)
        {
            var map = Served(maps, "dravsko_polje_meadow", seed);
            var gate = Assert.Single(map.Gates);
            var spawn = (10 * map.Width) + 10;
            var actors = map.Actors.ToHashSet();

            // The gate sits in the hedge row (19) and opens with the flag of Vera's quest.
            Assert.Equal((19, "hedgerow_open"), (gate.Y, gate.Flag));
            gateColumns.Add(gate.X);
            var closed = Reachable(map, spawn, cell => !map.Blocked[cell] && !actors.Contains(cell));
            var open = Reachable(map, spawn, cell => !map.Blocked[cell] && (!actors.Contains(cell) || cell == (gate.Y * map.Width) + gate.X));
            Assert.DoesNotContain(Enumerable.Range(20 * map.Width, 7 * map.Width), cell => closed[cell]);
            Assert.Contains(Enumerable.Range(20 * map.Width, 7 * map.Width), cell => open[cell]);

            // The first quest's sage grows within six steps of the spawn.
            var sage = map.Spots.Single(spot => spot.SpeciesId == "salvia_pratensis");
            var steps = Steps(map, spawn, cell => !map.Blocked[cell] && !actors.Contains(cell));
            Assert.InRange(steps[(sage.Y * map.Width) + sage.X], 1, 6);
        }

        Assert.True(gateColumns.Count >= 8, $"the gate took only {gateColumns.Count} places");
    }

    [Fact]
    public void The_cave_holds_only_its_own_species_and_the_olm_swims_in_its_pool()
    {
        var maps = new WorldMaps(FileContentCatalog.Load(ContentFolder.RepositoryContent()));
        for (long seed = 0; seed < 50; seed++)
        {
            var map = Served(maps, "rakov_skocjan_karst", seed);

            // Zelške jame is the generated cave east of the entrance (x 18–25).
            Assert.All(map.Spots, spot => Assert.Equal(spot.SpeciesId is "leptodirus_hochenwartii" or "rhinolophus_ferrumequinum" or "proteus_anguinus", spot.X >= 18));
            var olm = map.Spots.Single(spot => spot.SpeciesId == "proteus_anguinus");
            Assert.Equal(CavePool, map.Ground[(olm.Y * map.Width) + olm.X]);
        }
    }

    [Fact]
    public void The_water_lily_and_the_demoiselle_are_reached_by_wading()
    {
        var maps = new WorldMaps(FileContentCatalog.Load(ContentFolder.RepositoryContent()));
        for (long seed = 0; seed < 50; seed++)
        {
            var map = Served(maps, "cerknica_lake", seed);

            foreach (var spot in map.Spots.Where(spot => spot.SpeciesId is "nymphaea_alba" or "calopteryx_splendens"))
            {
                Assert.Equal(Shallows, map.Ground[(spot.Y * map.Width) + spot.X]);
                // Away from the shore: no walkable land beside it, so only the boots reach it.
                Assert.All(Neighbours(map, spot.X, spot.Y), cell => Assert.True(map.Blocked[cell]));
            }
        }
    }

    [Fact]
    public void The_same_seed_gives_the_same_map()
    {
        var catalog = FileContentCatalog.Load(ContentFolder.RepositoryContent());
        var one = new WorldMaps(catalog).Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, 482913), "kocevje_forest")!;
        var two = new WorldMaps(catalog).Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, 482913), "kocevje_forest")!;

        Assert.Equal(one.Json.ToArray(), two.Json.ToArray());
        Assert.Equal(one.EntityTag, two.EntityTag);
    }

    [Fact]
    public void A_fixed_world_seed_is_refused_outside_development()
    {
        var configuration = Configuration("42");

        var error = Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddInfrastructure(configuration, isDevelopment: false));
        Assert.Contains(DependencyInjection.FixedWorldSeedSetting, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void A_fixed_world_seed_gives_every_new_save_that_seed_in_development()
    {
        using var services = new ServiceCollection().AddInfrastructure(Configuration("42"), isDevelopment: true).BuildServiceProvider();
        var seeds = services.GetRequiredService<IWorldSeedSource>();

        Assert.Equal((42L, 42L), (seeds.NextSeed(), seeds.NextSeed()));
    }

    [Fact]
    public void Without_a_fixed_seed_new_saves_get_different_worlds()
    {
        using var services = new ServiceCollection().AddInfrastructure(Configuration(null), isDevelopment: true).BuildServiceProvider();
        var seeds = services.GetRequiredService<IWorldSeedSource>();

        Assert.NotEqual(seeds.NextSeed(), seeds.NextSeed());
    }

    /// <summary>A generated map as served: its ground tiles, collision and the tiles of its spots.</summary>
    private static ServedMap Served(WorldMaps maps, string mapId, long seed)
    {
        var json = maps.Find(SaveSlot.Create(Guid.NewGuid(), [1], DateTimeOffset.UnixEpoch, seed), mapId)!.Json;
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var layers = root.GetProperty("layers").EnumerateArray().ToList();
        int[] Tiles(string name) => [.. layers.First(layer => layer.GetProperty("name").GetString() == name).GetProperty("data").EnumerateArray().Select(gid => gid.GetInt32() - 1)];
        var spots = layers.Single(layer => layer.GetProperty("type").GetString() == "objectgroup").GetProperty("objects").EnumerateArray()
            .Where(o => o.GetProperty("type").GetString() == "spot")
            .Select(o => new ServedSpot(
                o.GetProperty("properties").EnumerateArray().First(p => p.GetProperty("name").GetString() == "speciesId").GetProperty("value").GetString()!,
                (int)(o.GetProperty("x").GetDouble() / TileSize),
                (int)(o.GetProperty("y").GetDouble() / TileSize)))
            .ToList();
        var tileObjects = layers.Single(layer => layer.GetProperty("type").GetString() == "objectgroup").GetProperty("objects").EnumerateArray()
            .Where(o => o.TryGetProperty("gid", out _))
            .Select(o => (Type: o.GetProperty("type").GetString(), X: (int)(o.GetProperty("x").GetDouble() / TileSize), Y: ((int)(o.GetProperty("y").GetDouble() / TileSize)) - 1, Object: o))
            .ToList();
        var width = root.GetProperty("width").GetInt32();
        var gates = tileObjects.Where(o => o.Type == "gate")
            .Select(o => new ServedGate(o.X, o.Y, o.Object.GetProperty("properties").EnumerateArray().Single(p => p.GetProperty("name").GetString() == "requiresFlag").GetProperty("value").GetString()!))
            .ToList();
        return new ServedMap(width, Tiles("ground"), [.. Tiles("collision").Select(tile => tile >= 0)], spots, gates, [.. tileObjects.Select(o => (o.Y * width) + o.X)]);
    }

    private static int[] Steps(ServedMap map, int from, Func<int, bool> passable)
    {
        var steps = Enumerable.Repeat(int.MaxValue, map.Ground.Length).ToArray();
        var queue = new Queue<int>([from]);
        steps[from] = 0;
        while (queue.TryDequeue(out var cell))
        {
            foreach (var next in Neighbours(map, cell % map.Width, cell / map.Width).Where(next => steps[next] == int.MaxValue && passable(next)))
            {
                steps[next] = steps[cell] + 1;
                queue.Enqueue(next);
            }
        }

        return steps;
    }

    private static bool[] Reachable(ServedMap map, int from, Func<int, bool> passable) => [.. Steps(map, from, passable).Select(step => step != int.MaxValue)];

    private static IEnumerable<int> Neighbours(ServedMap map, int x, int y) =>
        new[] { (X: x, Y: y - 1), (X: x + 1, Y: y), (X: x, Y: y + 1), (X: x - 1, Y: y) }
            .Where(p => p.X >= 0 && p.Y >= 0 && p.X < map.Width && p.Y < map.Ground.Length / map.Width)
            .Select(p => (p.Y * map.Width) + p.X);

    private static IConfiguration Configuration(string? fixedSeed) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            [$"ConnectionStrings:{DependencyInjection.ConnectionStringName}"] = "Host=localhost",
            [DependencyInjection.ContentRootPathSetting] = ContentFolder.RepositoryContent(),
            [DependencyInjection.FixedWorldSeedSetting] = fixedSeed,
        })
        .Build();

    private sealed record ServedSpot(string SpeciesId, int X, int Y);

    private sealed record ServedGate(int X, int Y, string Flag);

    /// <summary><see cref="Actors"/> are the tiles of NPCs, gates, the signpost and stations, which block.</summary>
    private sealed record ServedMap(int Width, int[] Ground, bool[] Blocked, IReadOnlyList<ServedSpot> Spots, IReadOnlyList<ServedGate> Gates, IReadOnlyList<int> Actors);
}
