using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Persistence;

namespace Slovion.IntegrationTests.Infrastructure;

/// <summary>Hosts the API in-process against the given database connection string.</summary>
public sealed class SlovionApiFactory(
    string connectionString,
    IReadOnlyDictionary<string, string?>? settings = null,
    Action<IServiceCollection>? configureServices = null)
    : WebApplicationFactory<Program>
{
    /// <summary>A connection string whose server refuses connections immediately; needs no Docker.</summary>
    public const string UnreachableDatabase =
        "Host=127.0.0.1;Port=1;Database=slovion;Username=slovion;Password=unused;Timeout=1";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting($"ConnectionStrings:{DependencyInjection.ConnectionStringName}", connectionString);

        // Without a database there is nothing to migrate; the API must still start (e.g. health = 503).
        if (connectionString == UnreachableDatabase)
        {
            builder.UseSetting(DatabaseMigration.MigrateOnStartupSetting, "false");
        }

        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
        {
            builder.UseSetting(key, value);
        }

        if (configureServices is not null)
        {
            builder.ConfigureTestServices(configureServices);
        }
    }
}
