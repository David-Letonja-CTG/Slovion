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

    [Theory]
    [InlineData("kocevje_forest", new[] { "ursus_arctos", "cervus_elaphus", "salamandra_salamandra", "allium_ursinum", "galium_odoratum" })]
    [InlineData("pohorje_forest", new[] { "canis_lupus", "sciurus_vulgaris", "drosera_rotundifolia", "vaccinium_myrtillus" })]
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

    private static IConfiguration Configuration(string? fixedSeed) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            [$"ConnectionStrings:{DependencyInjection.ConnectionStringName}"] = "Host=localhost",
            [DependencyInjection.ContentRootPathSetting] = ContentFolder.RepositoryContent(),
            [DependencyInjection.FixedWorldSeedSetting] = fixedSeed,
        })
        .Build();
}
