using Microsoft.EntityFrameworkCore;
using Npgsql;
using Slovion.Application.Discovery;
using Slovion.Domain.Discovery;

namespace Slovion.Infrastructure.Persistence;

internal sealed class EncounterRepository(SlovionDbContext db) : IEncounterRepository
{
    public async Task StartAsync(Encounter encounter, CancellationToken cancellationToken)
    {
        // Two concurrent starts can collide on the "one open encounter" index; the loser retries once.
        try
        {
            await CloseOpenAndInsertAsync(encounter, cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.ChangeTracker.Clear();
            await CloseOpenAndInsertAsync(encounter, cancellationToken);
        }
    }

    public Task<Encounter?> FindOpenAsync(Guid encounterId, Guid saveSlotId, CancellationToken cancellationToken) =>
        db.Encounters.AsNoTracking().SingleOrDefaultAsync(
            encounter => encounter.Id == encounterId && encounter.SaveSlotId == saveSlotId && encounter.ClosedAt == null,
            cancellationToken);

    public async Task<bool> CloseAsync(Guid encounterId, Guid saveSlotId, DateTimeOffset closedAt, CancellationToken cancellationToken)
    {
        // Atomic: of two concurrent answers, exactly one closes the encounter.
        var closed = await db.Encounters
            .Where(encounter => encounter.Id == encounterId && encounter.SaveSlotId == saveSlotId && encounter.ClosedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(encounter => encounter.ClosedAt, closedAt), cancellationToken);
        return closed == 1;
    }

    private async Task CloseOpenAndInsertAsync(Encounter encounter, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Encounters
            .Where(open => open.SaveSlotId == encounter.SaveSlotId && open.ClosedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(open => open.ClosedAt, encounter.CreatedAt), cancellationToken);
        db.Encounters.Add(encounter);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
