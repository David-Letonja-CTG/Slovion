using Slovion.Application.Content;
using Slovion.Application.Quests;
using Slovion.Application.Saves;
using Slovion.Domain.Content;
using Slovion.Domain.Saves;

namespace Slovion.Application.Travel;

/// <summary>
/// A region as one save sees it, in one language. <see cref="Identified"/> and <see cref="Required"/> are set for
/// species-count rules only; <see cref="LockedHint"/> only while the region is locked.
/// </summary>
public sealed record RegionView(string RegionId, string Name, string MapId, int X, int Y, bool Unlocked, int? Identified, int? Required, string? LockedHint);

/// <summary>The save's current region and every region in travel-list order.</summary>
public sealed record RegionsView(string CurrentRegionId, IReadOnlyList<RegionView> Regions);

public abstract record TravelResult
{
    private TravelResult()
    {
    }

    public sealed record Travelled(RegionView Region) : TravelResult;

    public sealed record Locked : TravelResult;

    public sealed record UnknownRegion : TravelResult;
}

/// <summary>Regions and travelling (docs/decisions.md D3): the server decides which regions a save may enter.</summary>
public sealed class TravelService(IContentCatalog content, ProgressReader progress, ISaveSlotRepository saveSlots)
{
    /// <summary>
    /// Every region with its state for the save. A current region that content no longer has is reported as the start
    /// region; the stored value is kept.
    /// </summary>
    public async Task<RegionsView> ListAsync(SaveSlot save, string language, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(save);
        var (flags, identified) = await ProgressOf(save, cancellationToken);
        var current = content.FindRegion(save.RegionId) is null ? Region.StartId : save.RegionId;
        return new RegionsView(current, content.AllRegions.Select(region => ViewOf(region, flags, identified, language)).ToList());
    }

    /// <summary>Makes an unlocked region the save's current region.</summary>
    public async Task<TravelResult> TravelAsync(SaveSlot save, string regionId, string language, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(save);
        if (content.FindRegion(regionId) is not { } region)
        {
            return new TravelResult.UnknownRegion();
        }

        var (flags, identified) = await ProgressOf(save, cancellationToken);
        if (!region.IsUnlockedFor(flags, identified))
        {
            return new TravelResult.Locked();
        }

        save.TravelTo(region.Id);
        await saveSlots.UpdateAsync(save, cancellationToken);
        return new TravelResult.Travelled(ViewOf(region, flags, identified, language));
    }

    private async Task<(IReadOnlyList<string> Flags, int Identified)> ProgressOf(SaveSlot save, CancellationToken cancellationToken) =>
        (await progress.FlagsAsync(save.Id, cancellationToken), await progress.IdentifiedCountAsync(save.Id, cancellationToken));

    private static RegionView ViewOf(Region region, IReadOnlyList<string> flags, int identified, string language)
    {
        var text = region.Text.TryGetValue(language, out var localized) ? localized : region.Text[IContentCatalog.DefaultLanguage];
        var unlocked = region.IsUnlockedFor(flags, identified);
        var required = (region.Unlock as UnlockRule.IdentifiedSpecies)?.Count;
        return new RegionView(region.Id, text.Name, region.MapId, region.X, region.Y, unlocked, required is null ? null : identified, required, unlocked ? null : text.LockedHint);
    }
}
