using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Application.Saves;
using Slovion.Infrastructure.Content;
using Slovion.Infrastructure.Persistence;

namespace Slovion.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Slovion";
    public const string DatabaseHealthCheckName = "database";
    public const string ContentRootPathSetting = "Content:RootPath";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{ConnectionStringName}' is not configured.");

        services.AddDbContext<SlovionDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<ISaveSlotRepository, SaveSlotRepository>();
        services.AddScoped<IDiscoveryRepository, DiscoveryRepository>();
        services.AddScoped<IEncounterRepository, EncounterRepository>();
        services.AddSingleton<IRandomSource, SystemRandomSource>();

        services.AddHealthChecks()
            .AddDbContextCheck<SlovionDbContext>(DatabaseHealthCheckName);

        // Content is loaded and validated eagerly: invalid content stops the API from starting.
        var contentRoot = ContentRootPath(configuration);
        services.AddSingleton<IContentCatalog>(FileContentCatalog.Load(contentRoot));

        return services;
    }

    /// <summary>The content folder: configurable, defaulting to the copy in the build output.</summary>
    public static string ContentRootPath(IConfiguration configuration) =>
        configuration[ContentRootPathSetting] ?? Path.Combine(AppContext.BaseDirectory, "content");
}
