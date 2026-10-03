using Slovion.Domain.Saves;

namespace Slovion.Application.Saves;

public interface ISaveSlotRepository
{
    Task AddAsync(SaveSlot slot, CancellationToken cancellationToken);

    Task<SaveSlot?> FindByTokenHashAsync(byte[] tokenHash, CancellationToken cancellationToken);

    /// <summary>Stores the slot's current region.</summary>
    Task UpdateAsync(SaveSlot slot, CancellationToken cancellationToken);
}
