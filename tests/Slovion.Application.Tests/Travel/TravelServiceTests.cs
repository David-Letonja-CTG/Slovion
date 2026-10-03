using Slovion.Application.Quests;
using Slovion.Application.Saves;
using Slovion.Application.Tests.Discovery;
using Slovion.Application.Tests.Quests;
using Slovion.Application.Travel;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;
using Slovion.Domain.Quests;
using Slovion.Domain.Saves;

namespace Slovion.Application.Tests.Travel;

public class TravelServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private static readonly string[] SpeciesIds = ["salvia_pratensis", "taraxacum_officinale", "lepus_europaeus", "alauda_arvensis"];
    private readonly SaveSlot save = SaveSlot.Create(Guid.NewGuid(), [1], June1);
    private readonly FakeContentCatalog catalog = new(SpeciesIds.Select(id => FakeContentCatalog.Species(id, id)).ToArray());
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly InMemoryQuestRepository quests = new();
    private readonly InMemorySaveSlotRepository saveSlots = new();
    private readonly TravelService service;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public TravelServiceTests()
    {
        catalog.Quests.Add(new Quest("eye_for_nature", "vera", 3, "hedgerow_open", new Dictionary<string, QuestText>()));
        catalog.Regions.Add(RegionOf("triglav", 4, new UnlockRule.IdentifiedSpecies(8)));
        catalog.Regions.Add(RegionOf("dravsko_polje", 1, new UnlockRule.Always()));
        catalog.Regions.Add(RegionOf("pohorje", 3, new UnlockRule.IdentifiedSpecies(6)));
        catalog.Regions.Add(RegionOf("kocevje", 2, new UnlockRule.Flag("hedgerow_open")));
        service = new TravelService(catalog, new ProgressReader(catalog, discoveries, quests), saveSlots);
    }

    [Fact]
    public async Task A_new_save_is_on_dravsko_polje_with_the_others_locked()
    {
        var view = await service.ListAsync(save, "sl", Token);

        Assert.Equal("dravsko_polje", view.CurrentRegionId);
        Assert.Equal(["dravsko_polje", "kocevje", "pohorje", "triglav"], view.Regions.Select(region => region.RegionId));
        Assert.Equal(new RegionView("dravsko_polje", "dravsko_polje ime", "dravsko_polje_map", 10, 20, true, null, null, null), view.Regions[0]);
        Assert.Equal(new RegionView("kocevje", "kocevje ime", "kocevje_map", 10, 20, false, null, null, "kocevje namig"), view.Regions[1]);
        Assert.Equal(new RegionView("pohorje", "pohorje ime", "pohorje_map", 10, 20, false, 0, 6, "pohorje namig"), view.Regions[2]);
    }

    [Fact]
    public async Task Vera_s_flag_opens_kocevje_and_counts_show_progress()
    {
        await CompleteVerasQuest();
        await Identify(3);

        var view = await service.ListAsync(save, "en", Token);

        Assert.True(view.Regions.Single(region => region.RegionId == "kocevje").Unlocked);
        var pohorje = view.Regions.Single(region => region.RegionId == "pohorje");
        Assert.False(pohorje.Unlocked);
        Assert.Equal((3, 6), (pohorje.Identified, pohorje.Required));
        Assert.Equal("pohorje ime", pohorje.Name); // no English text: falls back to Slovenian
    }

    [Fact]
    public async Task Travelling_to_an_open_region_stores_it()
    {
        await CompleteVerasQuest();

        var result = await service.TravelAsync(save, "kocevje", "sl", Token);

        Assert.Equal("kocevje", Assert.IsType<TravelResult.Travelled>(result).Region.RegionId);
        Assert.Equal("kocevje", save.RegionId);
        Assert.Equal("kocevje", saveSlots.StoredRegion(save.Id));
        Assert.Equal("kocevje", (await service.ListAsync(save, "sl", Token)).CurrentRegionId);
    }

    [Fact]
    public async Task A_locked_region_is_refused()
    {
        var result = await service.TravelAsync(save, "triglav", "sl", Token);

        Assert.IsType<TravelResult.Locked>(result);
        Assert.Equal("dravsko_polje", save.RegionId);
        Assert.Null(saveSlots.StoredRegion(save.Id));
    }

    [Fact]
    public async Task An_unknown_region_is_refused()
    {
        Assert.IsType<TravelResult.UnknownRegion>(await service.TravelAsync(save, "atlantis", "sl", Token));
        Assert.Equal("dravsko_polje", save.RegionId);
    }

    [Fact]
    public async Task A_removed_current_region_is_reported_as_the_start()
    {
        save.TravelTo("removed_region");

        var view = await service.ListAsync(save, "sl", Token);

        Assert.Equal("dravsko_polje", view.CurrentRegionId);
        Assert.Equal("removed_region", save.RegionId);
    }

    private static Region RegionOf(string id, int order, UnlockRule rule) =>
        new(id, $"{id}_map", order, 10, 20, rule, new Dictionary<string, RegionText> { ["sl"] = new($"{id} ime", $"{id} namig") });

    private async Task CompleteVerasQuest()
    {
        await quests.AddIfAbsentAsync(QuestProgress.Start(save.Id, "eye_for_nature", June1), Token);
        await quests.CompleteAsync(save.Id, "eye_for_nature", June1, Token);
    }

    private async Task Identify(int count)
    {
        foreach (var id in SpeciesIds.Take(count))
        {
            var speciesId = SpeciesId.Parse(id);
            await discoveries.AddIfAbsentAsync(SpeciesDiscovery.Observe(save.Id, Sighting.AtSpot(new MapSpot(FakeContentCatalog.MapId, id, speciesId)), June1), Token);
            await discoveries.IdentifyAsync(save.Id, speciesId, June1, Token);
        }
    }

    private sealed class InMemorySaveSlotRepository : ISaveSlotRepository
    {
        private readonly Dictionary<Guid, string> regions = [];

        public Task AddAsync(SaveSlot slot, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<SaveSlot?> FindByTokenHashAsync(byte[] tokenHash, CancellationToken cancellationToken) => Task.FromResult<SaveSlot?>(null);

        public Task UpdateAsync(SaveSlot slot, CancellationToken cancellationToken)
        {
            regions[slot.Id] = slot.RegionId;
            return Task.CompletedTask;
        }

        public string? StoredRegion(Guid id) => regions.GetValueOrDefault(id);
    }
}
