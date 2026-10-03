using Microsoft.EntityFrameworkCore;
using Slovion.Application.Quests;
using Slovion.Domain.Quests;

namespace Slovion.Infrastructure.Persistence;

internal sealed class QuestRepository(SlovionDbContext db) : IQuestRepository
{
    public async Task<(QuestProgress Stored, bool Added)> AddIfAbsentAsync(QuestProgress progress, CancellationToken cancellationToken)
    {
        // A single atomic statement: concurrent duplicates insert exactly one row.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO quest_progress (save_slot_id, quest_id, started_at)
            VALUES ({progress.SaveSlotId}, {progress.QuestId}, {progress.StartedAt})
            ON CONFLICT (save_slot_id, quest_id) DO NOTHING
            """,
            cancellationToken);

        if (inserted == 1)
        {
            return (progress, true);
        }

        return ((await FindAsync(progress.SaveSlotId, progress.QuestId, cancellationToken))!, false);
    }

    public Task<QuestProgress?> FindAsync(Guid saveSlotId, string questId, CancellationToken cancellationToken) =>
        db.QuestProgress.AsNoTracking().SingleOrDefaultAsync(
            stored => stored.SaveSlotId == saveSlotId && stored.QuestId == questId,
            cancellationToken);

    public async Task<QuestProgress> CompleteAsync(Guid saveSlotId, string questId, DateTimeOffset completedAt, CancellationToken cancellationToken)
    {
        // Only the first completion counts, also when two conversations race.
        await db.QuestProgress
            .Where(stored => stored.SaveSlotId == saveSlotId && stored.QuestId == questId && stored.CompletedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(stored => stored.CompletedAt, completedAt), cancellationToken);

        return await FindAsync(saveSlotId, questId, cancellationToken)
            ?? throw new InvalidOperationException($"Quest '{questId}' was completed without being started.");
    }

    public async Task<IReadOnlyList<QuestProgress>> ListAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        await db.QuestProgress.AsNoTracking()
            .Where(stored => stored.SaveSlotId == saveSlotId)
            .ToListAsync(cancellationToken);
}
