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

    /// <summary>Marks an observed species identified at research level 1, keeping an earlier identification. Returns the record.</summary>
    Task<SpeciesDiscovery> IdentifyAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset identifiedAt, CancellationToken cancellationToken);

    /// <summary>
    /// A sighting of an identified species at <paramref name="at"/>: raises its research level when the domain rule allows
    /// it (<see cref="SpeciesDiscovery.Research"/>). Returns the record and whether the level rose.
    /// </summary>
    Task<(SpeciesDiscovery Stored, bool Researched)> ResearchAsync(Guid saveSlotId, SpeciesId speciesId, DateTimeOffset at, DateTimeOffset saveCreatedAt, CancellationToken cancellationToken);

    Task<IReadOnlyList<SpeciesDiscovery>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken);
}
