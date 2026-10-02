using Slovion.Domain.Saves;

namespace Slovion.Application.Saves;

public interface ISaveSlotRepository
{
    Task AddAsync(SaveSlot slot, CancellationToken cancellationToken);

    Task<SaveSlot?> FindByTokenHashAsync(byte[] tokenHash, CancellationToken cancellationToken);
}
