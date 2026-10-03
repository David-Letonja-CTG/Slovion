using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Quests;

namespace Slovion.Application.Quests;

/// <summary>A save's progression: the species it has identified and the flags its completed quests earned.</summary>
public sealed class ProgressReader(IContentCatalog content, IDiscoveryRepository discoveries, IQuestRepository quests)
{
    /// <summary>The species the save has identified, whenever they were identified.</summary>
    public async Task<IReadOnlySet<SpeciesId>> IdentifiedSpeciesAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        (await discoveries.ListAsync(saveSlotId, cancellationToken))
            .Where(discovery => discovery.IsIdentified)
            .Select(discovery => discovery.SpeciesId)
            .ToHashSet();

    /// <summary>The number of species the save has identified, whenever they were identified.</summary>
    public async Task<int> IdentifiedCountAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        (await IdentifiedSpeciesAsync(saveSlotId, cancellationToken)).Count;

    /// <summary>
    /// Progress towards a quest's goal, capped at the goal: the identified species, only those of the goal's habitat
    /// when the quest names one.
    /// </summary>
    public int ProgressOf(Quest quest, IReadOnlySet<SpeciesId> identified)
    {
        ArgumentNullException.ThrowIfNull(quest);
        ArgumentNullException.ThrowIfNull(identified);
        var counted = quest.GoalHabitatId is { } habitatId
            ? content.AllHabitats.FirstOrDefault(habitat => habitat.Id == habitatId)?.Species.Count(entry => identified.Contains(entry.SpeciesId)) ?? 0
            : identified.Count;
        return Math.Min(counted, quest.IdentifiedSpeciesGoal);
    }

    /// <summary>The save's flags.</summary>
    public async Task<IReadOnlyList<string>> FlagsAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        FlagsOf(await quests.ListAsync(saveSlotId, cancellationToken));

    /// <summary>The reward flags of the completed quests that still exist in content.</summary>
    public IReadOnlyList<string> FlagsOf(IEnumerable<QuestProgress> all) =>
        all.Where(stored => stored.IsCompleted)
            .Select(stored => content.FindQuest(stored.QuestId)?.RewardFlag)
            .OfType<string>()
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();
}
