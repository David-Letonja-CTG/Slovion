using Slovion.Application.Content;
using Slovion.Application.Discovery;
using Slovion.Domain.Quests;

namespace Slovion.Application.Quests;

/// <summary>A save's progression: the species it has identified and the flags its completed quests earned.</summary>
public sealed class ProgressReader(IContentCatalog content, IDiscoveryRepository discoveries, IQuestRepository quests)
{
    /// <summary>The number of species the save has identified, whenever they were identified.</summary>
    public async Task<int> IdentifiedCountAsync(Guid saveSlotId, CancellationToken cancellationToken) =>
        (await discoveries.ListAsync(saveSlotId, cancellationToken)).Count(discovery => discovery.IsIdentified);

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
