using Slovion.Domain.Quests;

namespace Slovion.Domain.Tests.Quests;

public class QuestProgressTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Starts_active_for_one_save_slot()
    {
        var slot = Guid.NewGuid();

        var progress = QuestProgress.Start(slot, "eye_for_nature", June1);

        Assert.Equal((slot, "eye_for_nature", June1), (progress.SaveSlotId, progress.QuestId, progress.StartedAt));
        Assert.False(progress.IsCompleted);
    }

    [Fact]
    public void Completes_once()
    {
        var progress = QuestProgress.Start(Guid.NewGuid(), "eye_for_nature", June1);

        progress.Complete(June1.AddHours(1));

        Assert.True(progress.IsCompleted);
        Assert.Equal(June1.AddHours(1), progress.CompletedAt);
        Assert.Throws<InvalidOperationException>(() => progress.Complete(June1.AddHours(2)));
    }

    [Fact]
    public void Cannot_complete_before_it_started()
    {
        var progress = QuestProgress.Start(Guid.NewGuid(), "eye_for_nature", June1);

        Assert.Throws<ArgumentOutOfRangeException>(() => progress.Complete(June1.AddMinutes(-1)));
    }

    [Fact]
    public void Needs_a_slot_and_a_quest()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => QuestProgress.Start(Guid.Empty, "eye_for_nature", June1));
        Assert.Throws<ArgumentException>(() => QuestProgress.Start(Guid.NewGuid(), " ", June1));
    }
}
