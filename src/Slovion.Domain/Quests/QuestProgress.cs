namespace Slovion.Domain.Quests;

/// <summary>A save slot's progress on one quest: started when first offered, completed once (docs/decisions.md D3).</summary>
public sealed class QuestProgress
{
    public Guid SaveSlotId { get; private set; }

    public string QuestId { get; private set; }

    public DateTimeOffset StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public bool IsCompleted => CompletedAt is not null;

    private QuestProgress(Guid saveSlotId, string questId, DateTimeOffset startedAt)
    {
        SaveSlotId = saveSlotId;
        QuestId = questId;
        StartedAt = startedAt;
    }

    public static QuestProgress Start(Guid saveSlotId, string questId, DateTimeOffset startedAt)
    {
        ArgumentOutOfRangeException.ThrowIfEqual(saveSlotId, Guid.Empty);
        ArgumentException.ThrowIfNullOrWhiteSpace(questId);
        return new QuestProgress(saveSlotId, questId, startedAt);
    }

    /// <exception cref="InvalidOperationException">The quest is already completed.</exception>
    public void Complete(DateTimeOffset completedAt)
    {
        if (IsCompleted)
        {
            throw new InvalidOperationException($"Quest '{QuestId}' is already completed.");
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(completedAt, StartedAt);
        CompletedAt = completedAt;
    }
}
