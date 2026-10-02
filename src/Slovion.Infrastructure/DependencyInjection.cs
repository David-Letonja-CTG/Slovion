using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Infrastructure.Persistence;

namespace Slovion.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Slovion";
    public const string DatabaseHealthCheckName = "database";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{ConnectionStringName}' is not configured.");

        services.AddDbContext<SlovionDbContext>(options => options.UseNpgsql(connectionString));

        services.AddHealthChecks()
            .AddDbContextCheck<SlovionDbContext>(DatabaseHealthCheckName);

        return services;
    }
}
