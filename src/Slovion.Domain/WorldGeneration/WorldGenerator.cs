using System.Globalization;

namespace Slovion.Domain.WorldGeneration;

/// <summary>
/// Fills a template's generated areas from their biomes (docs/decisions.md D13, design §6). A pure function: the same
/// template, biomes, world seed and version always give the same map. Each attempt is validated (everything that must
/// be reachable from the spawn is); a failed attempt is retried with the next sub-seed, and after
/// <see cref="MaxAttempts"/> the last one is repaired by carving the missing connections.
/// </summary>
public static class WorldGenerator
{
    /// <summary>The generation version every new save gets. Bump it when generation changes for existing seeds.</summary>
    public const int Version = 1;

    public const int MaxAttempts = 8;

    /// <exception cref="InvalidOperationException">Even the repaired map is invalid (the content cannot be placed).</exception>
    public static GeneratedMap Generate(MapTemplate template, IReadOnlyDictionary<string, Biome> biomes, long worldSeed, int version = Version)
    {
        ArgumentNullException.ThrowIfNull(template);
        ArgumentNullException.ThrowIfNull(biomes);
        foreach (var area in template.Areas)
        {
            if (!biomes.TryGetValue(area.BiomeId, out var biome))
            {
                throw new ArgumentException($"{template.MapId}: unknown biome '{area.BiomeId}'.", nameof(biomes));
            }

            if (area.Barrier is not null && (biome.Gate is null || biome.Border.Count == 0))
            {
                throw new ArgumentException($"{template.MapId}: area '{area.AreaId}' has a barrier, but biome '{biome.Id}' has no border or gate tile.", nameof(biomes));
            }
        }

        var seed = SeedHash.Of(string.Create(CultureInfo.InvariantCulture, $"{worldSeed}/{template.MapId}/v{version}"));
        MapBuild? last = null;
        for (var attempt = 0; attempt < MaxAttempts; attempt++)
        {
            var build = new MapBuild(template, biomes, new WorldRandom(SeedHash.Combine(seed, string.Create(CultureInfo.InvariantCulture, $"attempt:{attempt}"))));
            build.Run();
            if (build.Problems().Count == 0)
            {
                return build.ToMap(attempt + 1, repaired: false);
            }

            last = build;
        }

        last!.Repair();
        var problems = last.Problems();
        return problems.Count == 0
            ? last.ToMap(MaxAttempts, repaired: true)
            : throw new InvalidOperationException($"{template.MapId}: generation failed: {string.Join("; ", problems)}");
    }
}
