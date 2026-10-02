using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class MigrationUpgradeTests(PostgresFixture database)
{
    private const string WalkingSkeletonMigration = "20261002144433_InitialSaves";

    [Fact]
    public async Task Discoveries_from_the_walking_skeleton_become_identified_entries()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateEmptyDatabaseAsync(cancellationToken);
        await using var db = new SlovionDbContext(new DbContextOptionsBuilder<SlovionDbContext>().UseNpgsql(connectionString).Options);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(WalkingSkeletonMigration, cancellationToken);
        var slot = Guid.NewGuid();
        var discoveredAt = new DateTimeOffset(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO save_slots (id, token_hash, created_at) VALUES ({slot}, {new byte[] { 1, 2, 3 }}, {discoveredAt})",
            cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO discoveries (save_slot_id, species_id, map_id, spot_id, discovered_at) VALUES ({slot}, {"salvia_pratensis"}, {"dravsko_polje_meadow"}, {"meadow_sage_1"}, {discoveredAt})",
            cancellationToken);

        await migrator.MigrateAsync(cancellationToken: cancellationToken);

        var entry = await db.Discoveries.AsNoTracking().SingleAsync(d => d.SaveSlotId == slot, cancellationToken);
        Assert.Equal(discoveredAt, entry.ObservedAt);
        Assert.Equal(discoveredAt, entry.IdentifiedAt);
    }

    private async Task<string> CreateEmptyDatabaseAsync(CancellationToken cancellationToken)
    {
        var name = $"upgrade_{Guid.NewGuid():N}";
        await using (var connection = new NpgsqlConnection(database.ConnectionString))
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand($"CREATE DATABASE {name}", connection);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        return new NpgsqlConnectionStringBuilder(database.ConnectionString) { Database = name }.ConnectionString;
    }
}
