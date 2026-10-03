namespace Slovion.Domain.Content;

/// <summary>A non-player character. Its name is a game label in each language (docs/decisions.md D7, D10).</summary>
public sealed record Npc(string Id, IReadOnlyDictionary<string, string> Names);

/// <summary>An NPC standing in a map.</summary>
public sealed record MapNpc(string MapId, Npc Npc);

/// <summary>The quest states that have their own dialogue.</summary>
public enum QuestDialogue
{
    Offer,
    Active,
    Ready,
    Completed,
}

/// <summary>A quest's texts in one language: game dialogue, never species facts.</summary>
public sealed record QuestText(string Title, string Summary, string ReturnHint, IReadOnlyDictionary<QuestDialogue, IReadOnlyList<string>> Dialogue);

/// <summary>
/// A quest given by an NPC: identify <see cref="IdentifiedSpeciesGoal"/> species to earn <see cref="RewardFlag"/>. When
/// <see cref="GoalHabitatId"/> is set, only identified species of that habitat count. <see cref="RewardItems"/> are tools the
/// reward also gives.
/// The goal and the reward are gameplay data (docs/decisions.md D6).
/// </summary>
public sealed record Quest(string Id, string GiverId, int IdentifiedSpeciesGoal, string RewardFlag, IReadOnlyDictionary<string, QuestText> Text, string? GoalHabitatId = null, IReadOnlyList<string>? RewardItems = null);
