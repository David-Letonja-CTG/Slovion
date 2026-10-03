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

    [Fact]
    public async Task Existing_saves_start_on_dravsko_polje()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateEmptyDatabaseAsync(cancellationToken);
        await using var db = new SlovionDbContext(new DbContextOptionsBuilder<SlovionDbContext>().UseNpgsql(connectionString).Options);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync("20261002221318_AddQuests", cancellationToken);
        var slot = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO save_slots (id, token_hash, created_at) VALUES ({slot}, {new byte[] { 4, 5, 6 }}, {DateTimeOffset.UnixEpoch})",
            cancellationToken);

        await migrator.MigrateAsync(cancellationToken: cancellationToken);

        Assert.Equal("dravsko_polje", (await db.SaveSlots.AsNoTracking().SingleAsync(s => s.Id == slot, cancellationToken)).RegionId);
    }

    [Fact]
    public async Task Species_identified_before_research_start_at_level_1()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await CreateEmptyDatabaseAsync(cancellationToken);
        await using var db = new SlovionDbContext(new DbContextOptionsBuilder<SlovionDbContext>().UseNpgsql(connectionString).Options);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync("20261003134737_AddCurrentRegion", cancellationToken);
        var slot = Guid.NewGuid();
        var observedAt = new DateTimeOffset(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
        var identifiedAt = observedAt.AddMinutes(5);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO save_slots (id, token_hash, created_at) VALUES ({slot}, {new byte[] { 7, 8, 9 }}, {observedAt})",
            cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO discoveries (save_slot_id, species_id, map_id, spot_id, observed_at, identified_at) VALUES ({slot}, {"salvia_pratensis"}, {"dravsko_polje_meadow"}, {"meadow_sage_1"}, {observedAt}, {identifiedAt})",
            cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO discoveries (save_slot_id, species_id, map_id, spot_id, observed_at) VALUES ({slot}, {"lepus_europaeus"}, {"dravsko_polje_meadow"}, {"meadow_hare_1"}, {observedAt})",
            cancellationToken);

        await migrator.MigrateAsync(cancellationToken: cancellationToken);

        var entries = await db.Discoveries.AsNoTracking().Where(d => d.SaveSlotId == slot).ToListAsync(cancellationToken);
        var sage = entries.Single(d => d.SpeciesId.Value == "salvia_pratensis");
        Assert.Equal((1, identifiedAt), (sage.ResearchLevel, sage.ResearchedAt));
        var hare = entries.Single(d => d.SpeciesId.Value == "lepus_europaeus");
        Assert.Equal((0, (DateTimeOffset?)null), (hare.ResearchLevel, hare.ResearchedAt));
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
