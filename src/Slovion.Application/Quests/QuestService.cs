using System.Globalization;
using Slovion.Application.Content;
using Slovion.Domain.Content;
using Slovion.Domain.Quests;

namespace Slovion.Application.Quests;

public enum QuestStatus
{
    Active,
    Completed,
}

/// <summary>A quest as the player sees it, in one language. Progress is capped at the goal.</summary>
public sealed record QuestView(string QuestId, string Title, string Summary, string ReturnHint, QuestStatus Status, int Progress, int Goal);

/// <summary>A save's progress: the flags earned from completed quests and every started quest.</summary>
public sealed record PlayerProgress(IReadOnlyList<string> Flags, IReadOnlyList<QuestView> Quests);

public abstract record TalkResult
{
    private TalkResult()
    {
    }

    public sealed record UnknownNpc : TalkResult;

    /// <summary>What the NPC says, the quest's state afterwards, and the save's flags afterwards.</summary>
    public sealed record Conversation(string NpcName, IReadOnlyList<string> Lines, QuestView Quest, IReadOnlyList<string> Flags) : TalkResult;
}

/// <summary>
/// Quests and progression (docs/decisions.md D3): the server decides what an NPC says and every quest change.
/// Progress is the number of species the save has identified, whenever they were identified.
/// </summary>
public sealed class QuestService(IContentCatalog content, ProgressReader progressReader, IQuestRepository quests, TimeProvider time)
{
    /// <summary>Talks to an NPC on a map: starts, reports on or completes its quest.</summary>
    public async Task<TalkResult> TalkAsync(Guid saveSlotId, string mapId, string npcId, string language, CancellationToken cancellationToken)
    {
        if (content.FindNpcOnMap(mapId, npcId) is not { } placed || content.FindQuestByGiver(placed.Npc.Id) is not { } quest)
        {
            return new TalkResult.UnknownNpc();
        }

        var text = TextFor(quest, language);
        var progress = Math.Min(await progressReader.IdentifiedCountAsync(saveSlotId, cancellationToken), quest.IdentifiedSpeciesGoal);
        var now = time.GetUtcNow();
        var lines = new List<string>();

        var stored = await quests.FindAsync(saveSlotId, quest.Id, cancellationToken);
        if (stored is null)
        {
            (stored, var added) = await quests.AddIfAbsentAsync(QuestProgress.Start(saveSlotId, quest.Id, now), cancellationToken);
            if (added)
            {
                lines.AddRange(text.Dialogue[QuestDialogue.Offer]);
            }
        }

        if (!stored.IsCompleted && progress >= quest.IdentifiedSpeciesGoal)
        {
            stored = await quests.CompleteAsync(saveSlotId, quest.Id, now, cancellationToken);
            lines.AddRange(text.Dialogue[QuestDialogue.Ready]);
        }
        else if (lines.Count == 0)
        {
            var state = stored.IsCompleted ? QuestDialogue.Completed : QuestDialogue.Active;
            lines.AddRange(text.Dialogue[state].Select(line => Fill(line, progress, quest.IdentifiedSpeciesGoal)));
        }

        var all = await quests.ListAsync(saveSlotId, cancellationToken);
        return new TalkResult.Conversation(NameOf(placed.Npc, language), lines, ViewOf(quest, text, stored, progress), progressReader.FlagsOf(all));
    }

    /// <summary>The save's flags and started quests, for loading the game.</summary>
    public async Task<PlayerProgress> GetProgressAsync(Guid saveSlotId, string language, CancellationToken cancellationToken)
    {
        var identified = await progressReader.IdentifiedCountAsync(saveSlotId, cancellationToken);
        var all = await quests.ListAsync(saveSlotId, cancellationToken);
        var views = all
            .OrderBy(stored => stored.StartedAt)
            .ThenBy(stored => stored.QuestId, StringComparer.Ordinal)
            .Select(stored => (stored, quest: content.FindQuest(stored.QuestId)))
            .Where(pair => pair.quest is not null) // content removed since: skip, keep the record
            .Select(pair => ViewOf(pair.quest!, TextFor(pair.quest!, language), pair.stored, Math.Min(identified, pair.quest!.IdentifiedSpeciesGoal)))
            .ToList();
        return new PlayerProgress(progressReader.FlagsOf(all), views);
    }

    private static QuestView ViewOf(Quest quest, QuestText text, QuestProgress stored, int progress) =>
        new(quest.Id, text.Title, text.Summary, text.ReturnHint, stored.IsCompleted ? QuestStatus.Completed : QuestStatus.Active, progress, quest.IdentifiedSpeciesGoal);

    private static string Fill(string line, int progress, int goal) =>
        line.Replace("{identified}", progress.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal)
            .Replace("{goal}", goal.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal);

    private static QuestText TextFor(Quest quest, string language) =>
        quest.Text.TryGetValue(language, out var text) ? text : quest.Text[IContentCatalog.DefaultLanguage];

    private static string NameOf(Npc npc, string language) =>
        npc.Names.TryGetValue(language, out var name) ? name : npc.Names[IContentCatalog.DefaultLanguage];
}
