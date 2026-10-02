using Microsoft.EntityFrameworkCore;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Infrastructure.Persistence;

internal sealed class DiscoveryRepository(SlovionDbContext db) : IDiscoveryRepository
{
    public async Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(SpeciesDiscovery discovery, CancellationToken cancellationToken)
    {
        // A single atomic statement: concurrent duplicates insert exactly one row.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO discoveries (save_slot_id, species_id, map_id, spot_id, habitat_id, observed_at)
            VALUES ({discovery.SaveSlotId}, {discovery.SpeciesId.Value}, {discovery.MapId}, {discovery.SpotId}, {discovery.HabitatId}, {discovery.ObservedAt})
            ON CONFLICT (save_slot_id, species_id) DO NOTHING
            """,
            cancellationToken);

        if (inserted == 1)
        {
            return (discovery, true);
        }

        return ((await FindAsync(discovery.SaveSlotId, discovery.SpeciesId, cancellationToken))!, false);
    }

    public Task<SpeciesDiscovery?> FindAsync(Guid saveSlotId, SpeciesId speciesId, CancellationToken cancellationToken) =>
        db.Discoveries.AsNoTracking().SingleOrDefaultAsync(
            stored => stored.SaveSlotId == saveSlotId && stored.SpeciesId == speciesId,
            cancellationToken);

    public async Task<SpeciesDiscovery> IdentifyAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset identifiedAt, CancellationToken cancellationToken)
    {
        // Only the first identification counts, also when two answers race.
        await db.Discoveries
            .Where(stored => stored.SaveSlotId == saveSlotId && stored.SpeciesId == speciesId && stored.IdentifiedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(stored => stored.IdentifiedAt, identifiedAt), cancellationToken);

        return await FindAsync(saveSlotId, speciesId, cancellationToken)
            ?? throw new InvalidOperationException($"Species '{speciesId}' was identified without being observed.");
    }

    public async Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        await db.Discoveries.AsNoTracking()
            .Where(discovery => discovery.SaveSlotId == saveSlotId)
            .ToListAsync(cancellationToken);
}
