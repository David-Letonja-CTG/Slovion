using Slovion.Application.Quests;
using Slovion.Domain.Quests;

namespace Slovion.Application.Tests.Quests;

internal sealed class InMemoryQuestRepository : IQuestRepository
{
    private readonly List<QuestProgress> stored = [];

    public Task<(QuestProgress Stored, bool Added)> AddIfAbsentAsync(QuestProgress progress, CancellationToken cancellationToken)
    {
        var existing = Find(progress.SaveSlotId, progress.QuestId);
        if (existing is not null)
        {
            return Task.FromResult((existing, false));
        }

        stored.Add(progress);
        return Task.FromResult((progress, true));
    }

    public Task<QuestProgress?> FindAsync(Guid saveSlotId, string questId, CancellationToken cancellationToken) =>
        Task.FromResult(Find(saveSlotId, questId));

    public Task<QuestProgress> CompleteAsync(Guid saveSlotId, string questId, DateTimeOffset completedAt, CancellationToken cancellationToken)
    {
        var progress = Find(saveSlotId, questId) ?? throw new InvalidOperationException("Not started.");
        if (!progress.IsCompleted)
        {
            progress.Complete(completedAt);
        }

        return Task.FromResult(progress);
    }

    public Task<IReadOnlyList<QuestProgress>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<QuestProgress>>(stored.Where(progress => progress.SaveSlotId == saveSlotId).ToList());

    private QuestProgress? Find(Guid saveSlotId, string questId) =>
        stored.SingleOrDefault(progress => progress.SaveSlotId == saveSlotId && progress.QuestId == questId);
}
