using Microsoft.EntityFrameworkCore;
using Slovion.Application.Discovery;
using Slovion.Domain.Discovery;

namespace Slovion.Infrastructure.Persistence;

internal sealed class DiscoveryRepository(SlovionDbContext db) : IDiscoveryRepository
{
    public async Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(
        SpeciesDiscovery discovery,
        CancellationToken cancellationToken)
    {
        // A single atomic statement: concurrent duplicates insert exactly one row.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO discoveries (save_slot_id, species_id, map_id, spot_id, discovered_at)
            VALUES ({discovery.SaveSlotId}, {discovery.SpeciesId.Value}, {discovery.MapId}, {discovery.SpotId}, {discovery.DiscoveredAt})
            ON CONFLICT (save_slot_id, species_id) DO NOTHING
            """,
            cancellationToken);

        if (inserted == 1)
        {
            return (discovery, true);
        }

        var existing = await db.Discoveries.AsNoTracking().SingleAsync(
            stored => stored.SaveSlotId == discovery.SaveSlotId && stored.SpeciesId == discovery.SpeciesId,
            cancellationToken);
        return (existing, false);
    }

    public async Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        await db.Discoveries.AsNoTracking()
            .Where(discovery => discovery.SaveSlotId == saveSlotId)
            .ToListAsync(cancellationToken);
}
