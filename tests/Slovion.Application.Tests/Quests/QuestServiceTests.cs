using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Quests;
using Slovion.Application.Tests.Discovery;
using Slovion.Domain.Content;
using Slovion.Domain.Discovery;

namespace Slovion.Application.Tests.Quests;

public class QuestServiceTests
{
    private static readonly DateTimeOffset June1 = new(2026, 6, 1, 10, 0, 0, TimeSpan.Zero);
    private static readonly string[] SpeciesIds = ["salvia_pratensis", "taraxacum_officinale", "lepus_europaeus", "alauda_arvensis"];
    private readonly FakeTimeProvider time = new(June1);
    private readonly Guid slot = Guid.NewGuid();
    private readonly FakeContentCatalog catalog = new(SpeciesIds.Select(id => FakeContentCatalog.Species(id, id)).ToArray());
    private readonly InMemoryDiscoveryRepository discoveries = new();
    private readonly InMemoryQuestRepository progress = new();
    private readonly QuestService service;

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    public QuestServiceTests()
    {
        catalog.Npcs.Add(new Npc("vera", new Dictionary<string, string> { ["sl"] = "Vera", ["en"] = "Vera (en)" }));
        catalog.Quests.Add(new Quest("eye_for_nature", "vera", 3, "hedgerow_open", new Dictionary<string, QuestText>
        {
            ["sl"] = new("Oko za naravo", "Prepoznaj tri vrste.", "Vrni se k Veri.", new Dictionary<QuestDialogue, IReadOnlyList<string>>
            {
                [QuestDialogue.Offer] = ["offer 1", "offer 2"],
                [QuestDialogue.Active] = ["active {identified}/{goal}"],
                [QuestDialogue.Ready] = ["ready"],
                [QuestDialogue.Completed] = ["completed"],
            }),
        }));
        service = new QuestService(catalog, new ProgressReader(catalog, discoveries, progress), progress, time);
    }

    private async Task Identify(int count)
    {
        foreach (var id in SpeciesIds.Take(count))
        {
            var speciesId = SpeciesId.Parse(id);
            await discoveries.AddIfAbsentAsync(SpeciesDiscovery.Observe(slot, Sighting.AtSpot(new MapSpot(FakeContentCatalog.MapId, id, speciesId)), June1), Token);
            await discoveries.IdentifyAsync(slot, speciesId, June1, Token);
        }
    }

    private async Task<TalkResult.Conversation> Talk(string language = "sl") =>
        Assert.IsType<TalkResult.Conversation>(await service.TalkAsync(slot, FakeContentCatalog.MapId, "vera", language, Token));

    [Fact]
    public async Task The_first_talk_offers_and_starts_the_quest()
    {
        var conversation = await Talk();

        Assert.Equal("Vera", conversation.NpcName);
        Assert.Equal(["offer 1", "offer 2"], conversation.Lines);
        Assert.Equal(new QuestView("eye_for_nature", "Oko za naravo", "Prepoznaj tri vrste.", "Vrni se k Veri.", QuestStatus.Active, 0, 3), conversation.Quest);
        Assert.Empty(conversation.Flags);
        Assert.Equal(June1, (await progress.FindAsync(slot, "eye_for_nature", Token))?.StartedAt);
    }

    [Fact]
    public async Task An_active_quest_reports_its_progress()
    {
        await Talk();
        await Identify(1);

        var conversation = await Talk();

        Assert.Equal(["active 1/3"], conversation.Lines);
        Assert.Equal((QuestStatus.Active, 1), (conversation.Quest.Status, conversation.Quest.Progress));
    }

    [Fact]
    public async Task A_habitat_goal_counts_only_that_habitat_s_species()
    {
        // The forest lists the hare and the skylark; the first three identified species are sage, dandelion and hare.
        catalog.Habitats.Add(FakeContentCatalog.Habitat("forest", 3, "Gozd", null, SpeciesId.Parse("lepus_europaeus"), SpeciesId.Parse("alauda_arvensis")));
        catalog.Npcs.Add(new Npc("jure", new Dictionary<string, string> { ["sl"] = "Jure" }));
        catalog.Quests.Add(new Quest("in_the_shade_of_firs", "jure", 2, "pohorje_open", catalog.Quests[0].Text, "forest"));
        await Identify(3);

        var first = Assert.IsType<TalkResult.Conversation>(await service.TalkAsync(slot, FakeContentCatalog.MapId, "jure", "sl", Token));
        Assert.Equal((QuestStatus.Active, 1, 2), (first.Quest.Status, first.Quest.Progress, first.Quest.Goal));
        Assert.Equal(1, (await service.GetProgressAsync(slot, "sl", Token)).Quests.Single(quest => quest.QuestId == "in_the_shade_of_firs").Progress);

        await Identify(4);
        var second = Assert.IsType<TalkResult.Conversation>(await service.TalkAsync(slot, FakeContentCatalog.MapId, "jure", "sl", Token));

        Assert.Equal((QuestStatus.Completed, 2), (second.Quest.Status, second.Quest.Progress));
        Assert.Contains("pohorje_open", second.Flags);
    }

    [Fact]
    public async Task Observed_species_do_not_count()
    {
        await Talk();
        var hare = SpeciesId.Parse("lepus_europaeus");
        await discoveries.AddIfAbsentAsync(SpeciesDiscovery.Observe(slot, Sighting.AtSpot(new MapSpot(FakeContentCatalog.MapId, "hare", hare)), June1), Token);

        Assert.Equal(0, (await Talk()).Quest.Progress);
    }

    [Fact]
    public async Task Meeting_the_goal_completes_the_quest_and_sets_its_flag()
    {
        await Talk();
        await Identify(3);
        time.Advance(TimeSpan.FromHours(1));

        var conversation = await Talk();

        Assert.Equal(["ready"], conversation.Lines);
        Assert.Equal((QuestStatus.Completed, 3), (conversation.Quest.Status, conversation.Quest.Progress));
        Assert.Equal(["hedgerow_open"], conversation.Flags);
        Assert.Equal(June1.AddHours(1), (await progress.FindAsync(slot, "eye_for_nature", Token))?.CompletedAt);
    }

    [Fact]
    public async Task A_goal_met_before_the_first_talk_offers_and_completes_at_once()
    {
        await Identify(3);

        var conversation = await Talk();

        Assert.Equal(["offer 1", "offer 2", "ready"], conversation.Lines);
        Assert.Equal(QuestStatus.Completed, conversation.Quest.Status);
        Assert.Equal(["hedgerow_open"], conversation.Flags);
    }

    [Fact]
    public async Task A_completed_quest_stays_completed()
    {
        await Identify(3);
        await Talk();
        time.Advance(TimeSpan.FromHours(1));

        var conversation = await Talk();

        Assert.Equal(["completed"], conversation.Lines);
        Assert.Equal(QuestStatus.Completed, conversation.Quest.Status);
        Assert.Equal(June1, (await progress.FindAsync(slot, "eye_for_nature", Token))?.CompletedAt);
    }

    [Fact]
    public async Task Progress_is_capped_at_the_goal()
    {
        await Identify(4);

        Assert.Equal(3, (await Talk()).Quest.Progress);
    }

    [Theory]
    [InlineData("other_map", "vera")]
    [InlineData(FakeContentCatalog.MapId, "mojca")]
    public async Task Unknown_NPCs_change_nothing(string mapId, string npcId)
    {
        var result = await service.TalkAsync(slot, mapId, npcId, "sl", Token);

        Assert.IsType<TalkResult.UnknownNpc>(result);
        Assert.Empty(await progress.ListAsync(slot, Token));
    }

    [Fact]
    public async Task Names_and_texts_fall_back_to_Slovenian()
    {
        var conversation = await Talk("en");

        Assert.Equal("Vera (en)", conversation.NpcName);
        Assert.Equal("Oko za naravo", conversation.Quest.Title);
    }

    [Fact]
    public async Task Progress_lists_started_quests_and_earned_flags()
    {
        var fresh = await service.GetProgressAsync(slot, "sl", Token);
        Assert.Empty(fresh.Flags);
        Assert.Empty(fresh.Quests);

        await Talk();
        await Identify(2);
        var active = await service.GetProgressAsync(slot, "sl", Token);
        Assert.Empty(active.Flags);
        Assert.Equal((QuestStatus.Active, 2, 3), (active.Quests.Single().Status, active.Quests.Single().Progress, active.Quests.Single().Goal));

        await Identify(3);
        await Talk();
        var done = await service.GetProgressAsync(slot, "sl", Token);
        Assert.Equal(["hedgerow_open"], done.Flags);
        Assert.Equal(QuestStatus.Completed, done.Quests.Single().Status);
    }

    [Fact]
    public async Task Progress_skips_quests_no_longer_in_content()
    {
        await Identify(3);
        await Talk();
        catalog.Quests.Clear();

        var progressNow = await service.GetProgressAsync(slot, "sl", Token);

        Assert.Empty(progressNow.Flags);
        Assert.Empty(progressNow.Quests);
    }
}
