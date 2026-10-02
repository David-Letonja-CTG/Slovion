using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

/// <summary>A save slot's NatureDex records.</summary>
public interface IDiscoveryRepository
{
    /// <summary>
    /// Stores the observation unless the slot already observed that species. Safe under concurrency.
    /// Returns the stored record and whether it was added by this call.
    /// </summary>
    Task<(SpeciesDiscovery Stored, bool Added)> AddIfAbsentAsync(SpeciesDiscovery discovery, CancellationToken cancellationToken);

    Task<SpeciesDiscovery?> FindAsync(Guid saveSlotId, SpeciesId speciesId, CancellationToken cancellationToken);

    /// <summary>Marks an observed species identified, keeping an earlier identification time. Returns the record.</summary>
    Task<SpeciesDiscovery> IdentifyAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset identifiedAt, CancellationToken cancellationToken);

    Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken);
}
