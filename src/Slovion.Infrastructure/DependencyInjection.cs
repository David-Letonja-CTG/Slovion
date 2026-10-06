using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Application.Quests;
using Slovion.Application.Saves;
using Slovion.Infrastructure.Content;
using Slovion.Infrastructure.Persistence;

namespace Slovion.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Slovion";
    public const string DatabaseHealthCheckName = "database";
    public const string ContentRootPathSetting = "Content:RootPath";

    /// <summary>A world seed for every new save; allowed in development (and end-to-end tests) only.</summary>
    public const string FixedWorldSeedSetting = "WorldGeneration:FixedSeed";

    /// <exception cref="InvalidOperationException">A fixed world seed is configured outside development.</exception>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, bool isDevelopment = false)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{ConnectionStringName}' is not configured.");

        services.AddDbContext<SlovionDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<ISaveSlotRepository, SaveSlotRepository>();
        services.AddScoped<IDiscoveryRepository, DiscoveryRepository>();
        services.AddScoped<IEncounterRepository, EncounterRepository>();
        services.AddScoped<IQuestRepository, QuestRepository>();
        services.AddSingleton<IRandomSource, SystemRandomSource>();
        if (configuration[FixedWorldSeedSetting] is { } text && long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var fixedSeed))
        {
            services.AddSingleton<IWorldSeedSource>(isDevelopment
                ? new FixedWorldSeedSource(fixedSeed)
                : throw new InvalidOperationException($"'{FixedWorldSeedSetting}' is for development only; every production save needs its own world."));
        }
        else
        {
            services.AddSingleton<IWorldSeedSource, RandomWorldSeedSource>();
        }

        services.AddHealthChecks()
            .AddDbContextCheck<SlovionDbContext>(DatabaseHealthCheckName);

        // Content is loaded and validated eagerly: invalid content stops the API from starting.
        var contentRoot = ContentRootPath(configuration);
        var catalog = FileContentCatalog.Load(contentRoot);
        services.AddSingleton<IContentCatalog>(catalog);
        services.AddSingleton<IWorldMaps>(new WorldMaps(catalog));

        return services;
    }

    /// <summary>The content folder: configurable, defaulting to the copy in the build output.</summary>
    public static string ContentRootPath(IConfiguration configuration) =>
        configuration[ContentRootPathSetting] ?? Path.Combine(AppContext.BaseDirectory, "content");
}
