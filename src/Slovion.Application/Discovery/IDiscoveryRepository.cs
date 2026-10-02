using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

public interface IDiscoveryRepository
{
    /// <summary>
    /// Stores the discovery unless the slot already discovered that species. Safe under concurrency.
    /// Returns the stored discovery and whether it was added by this call.
    /// </summary>
    Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(SpeciesDiscovery discovery, CancellationToken cancellationToken);

    Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken);
}
