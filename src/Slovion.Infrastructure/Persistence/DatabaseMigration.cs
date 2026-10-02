using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Slovion.Infrastructure.Persistence;

public static class DatabaseMigration
{
    public const string MigrateOnStartupSetting = "Database:MigrateOnStartup";

    /// <summary>Applies pending migrations. Suitable for a single API instance (see design).</summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }
}
