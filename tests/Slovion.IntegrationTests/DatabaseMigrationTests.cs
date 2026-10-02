using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class DatabaseMigrationTests(PostgresFixture database)
{
    [Fact]
    public async Task Startup_creates_the_player_state_tables()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        var cancellationToken = TestContext.Current.CancellationToken;

        var tables = await db.Database
            .SqlQuery<string>($"SELECT table_name AS \"Value\" FROM information_schema.tables WHERE table_schema = 'public'")
            .ToListAsync(cancellationToken);

        Assert.Contains("save_slots", tables);
        Assert.Contains("discoveries", tables);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(cancellationToken));
    }
}
