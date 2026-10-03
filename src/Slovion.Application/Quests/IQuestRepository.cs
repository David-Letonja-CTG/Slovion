using Slovion.Domain.Quests;

namespace Slovion.Application.Quests;

/// <summary>A save slot's quest progress.</summary>
public interface IQuestRepository
{
    /// <summary>
    /// Stores the started quest unless the slot already started it. Safe under concurrency.
    /// Returns the stored record and whether it was added by this call.
    /// </summary>
    Task<(QuestProgress Stored, bool Added)> AddIfAbsentAsync(QuestProgress progress, CancellationToken cancellationToken);

    Task<QuestProgress?> FindAsync(Guid saveSlotId, string questId, CancellationToken cancellationToken);

    /// <summary>Marks a started quest completed, keeping an earlier completion time. Returns the record.</summary>
    Task<QuestProgress> CompleteAsync(Guid saveSlotId, string questId, DateTimeOffset completedAt, CancellationToken cancellationToken);

    Task<IReadOnlyList<QuestProgress>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken);
}
