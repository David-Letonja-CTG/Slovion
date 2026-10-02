using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Slovion.Infrastructure;

namespace Slovion.IntegrationTests.Infrastructure;

/// <summary>Hosts the API in-process against the given database connection string.</summary>
public sealed class SlovionApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    /// <summary>A connection string whose server refuses connections immediately; needs no Docker.</summary>
    public const string UnreachableDatabase =
        "Host=127.0.0.1;Port=1;Database=slovion;Username=slovion;Password=unused;Timeout=1";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting($"ConnectionStrings:{DependencyInjection.ConnectionStringName}", connectionString);
    }
}
