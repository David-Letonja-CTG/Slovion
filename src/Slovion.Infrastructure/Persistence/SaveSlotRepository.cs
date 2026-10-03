using Microsoft.EntityFrameworkCore;
using Slovion.Application.Saves;
using Slovion.Domain.Saves;

namespace Slovion.Infrastructure.Persistence;

internal sealed class SaveSlotRepository(SlovionDbContext db) : ISaveSlotRepository
{
    public async Task AddAsync(SaveSlot slot, CancellationToken cancellationToken)
    {
        db.SaveSlots.Add(slot);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<SaveSlot?> FindByTokenHashAsync(byte[] tokenHash, CancellationToken cancellationToken) =>
        db.SaveSlots.AsNoTracking().SingleOrDefaultAsync(slot => slot.TokenHash == tokenHash, cancellationToken);

    public Task UpdateAsync(SaveSlot slot, CancellationToken cancellationToken) =>
        db.SaveSlots.Where(stored => stored.Id == slot.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(stored => stored.RegionId, slot.RegionId), cancellationToken);
}
