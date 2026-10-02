using Slovion.Domain.Discovery;

namespace Slovion.Application.Discovery;

public interface IEncounterRepository
{
    /// <summary>Closes the slot's open encounter, if any, and stores the new one. At most one stays open.</summary>
    Task StartAsync(Encounter encounter, CancellationToken cancellationToken);

    /// <summary>The slot's encounter with this ID, if it exists and is still open.</summary>
    Task<Encounter?> FindOpenAsync(Guid encounterId, Guid saveSlotId, CancellationToken cancellationToken);

    /// <summary>Closes the encounter if it is still open. Returns <c>false</c> if it was already closed or missing.</summary>
    Task<bool> CloseAsync(Guid encounterId, Guid saveSlotId, DateTimeOffset closedAt, CancellationToken cancellationToken);
}
