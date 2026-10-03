using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Saves;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class QuestTests(PostgresFixture database)
{
    private const string DandelionSpot = "meadow_dandelion_1";
    private const string Dandelion = "taraxacum_officinale";

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory() => new(database.ConnectionString);

    private static Task<HttpResponseMessage> TalkAsync(HttpClient client, string? token, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/conversations", UriKind.Relative)) { Content = JsonContent.Create(body) };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client.SendAsync(request, Token);
    }

    private static async Task<JsonElement> TalkToVeraAsync(HttpClient client, string token)
    {
        using var response = await TalkAsync(client, token, new { mapId = MeadowMap, npcId = "vera" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["sl"], response.Content.Headers.ContentLanguage);
        using var body = await ReadJsonAsync(response);
        return body.RootElement.Clone();
    }

    private static async Task<JsonElement> ProgressAsync(HttpClient client, string? token, HttpStatusCode expected = HttpStatusCode.OK)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/progress", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        Assert.Equal(expected, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        return body.RootElement.Clone();
    }

    private static async Task IdentifyThreeAsync(HttpClient client, string token)
    {
        await IdentifyAsync(client, token, SageSpot, Sage);
        await IdentifyAsync(client, token, DandelionSpot, Dandelion);
        await IdentifyAsync(client, token, HareSpot, Hare);
    }

    private static string[] Lines(JsonElement conversation) =>
        conversation.GetProperty("lines").EnumerateArray().Select(line => line.GetString()!).ToArray();

    private static string[] Items(JsonElement element) =>
        element.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("itemId").GetString()!).ToArray();

    private static string[] Flags(JsonElement element) =>
        element.GetProperty("flags").EnumerateArray().Select(flag => flag.GetString()!).ToArray();

    private static void AssertQuest(JsonElement quest, string status, int progress)
    {
        Assert.Equal("eye_for_nature", quest.GetProperty("questId").GetString());
        Assert.Equal("Oko za naravo", quest.GetProperty("title").GetString());
        Assert.Equal((status, progress, 3), (quest.GetProperty("status").GetString(), quest.GetProperty("progress").GetInt32(), quest.GetProperty("goal").GetInt32()));
    }

    [Fact]
    public async Task Meeting_Vera_starts_the_quest()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var conversation = await TalkToVeraAsync(client, token);

        Assert.Equal("Vera", conversation.GetProperty("npcName").GetString());
        Assert.Equal(3, Lines(conversation).Length);
        Assert.StartsWith("Živijo! Jaz sem Vera", Lines(conversation)[0], StringComparison.Ordinal);
        AssertQuest(conversation.GetProperty("quest"), "active", 0);
        Assert.Empty(Flags(conversation));
        Assert.Equal(["lamp"], Items(conversation));
        Assert.Equal("svetilka", conversation.GetProperty("items")[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task Vera_reports_progress_until_the_goal_is_met()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await TalkToVeraAsync(client, token);
        await IdentifyAsync(client, token, SageSpot, Sage);

        var conversation = await TalkToVeraAsync(client, token);

        Assert.Contains("Prepoznane vrste: 1 od 3.", Lines(conversation)[0], StringComparison.Ordinal);
        AssertQuest(conversation.GetProperty("quest"), "active", 1);
        AssertQuest((await ProgressAsync(client, token)).GetProperty("quests")[0], "active", 1);
    }

    [Fact]
    public async Task Completing_the_quest_sets_the_flag_and_survives_a_restart()
    {
        string token;
        await using (var before = Factory())
        {
            using var client = before.CreateClient();
            token = await CreateSaveAsync(client);
            await TalkToVeraAsync(client, token);
            await IdentifyThreeAsync(client, token);

            var conversation = await TalkToVeraAsync(client, token);

            Assert.StartsWith("Odlično!", Lines(conversation)[0], StringComparison.Ordinal);
            AssertQuest(conversation.GetProperty("quest"), "completed", 3);
            Assert.Equal(["hedgerow_open"], Flags(conversation));
            Assert.Equal(["lamp", "binoculars"], Items(conversation));
        }

        await using var after = Factory();
        using var restarted = after.CreateClient();
        var progress = await ProgressAsync(restarted, token);

        Assert.Equal(["hedgerow_open"], Flags(progress));
        AssertQuest(Assert.Single(progress.GetProperty("quests").EnumerateArray()), "completed", 3);

        await using var scope = after.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        var hash = SaveToken.Hash(token);
        var slotId = (await db.SaveSlots.SingleAsync(slot => slot.TokenHash == hash, Token)).Id;
        var stored = await db.QuestProgress.SingleAsync(quest => quest.SaveSlotId == slotId, Token);
        Assert.Equal("eye_for_nature", stored.QuestId);
        Assert.NotNull(stored.CompletedAt);
    }

    [Fact]
    public async Task A_goal_met_before_the_first_talk_completes_at_once()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await IdentifyThreeAsync(client, token);

        var conversation = await TalkToVeraAsync(client, token);

        Assert.Equal(5, Lines(conversation).Length); // three offer lines, then two ready lines
        AssertQuest(conversation.GetProperty("quest"), "completed", 3);
        Assert.Equal(["hedgerow_open"], Flags(conversation));

        var again = await TalkToVeraAsync(client, token);
        Assert.Equal(["Kako je pri mejici? Ne pozabi pogledati v grmovje."], Lines(again));
    }

    [Fact]
    public async Task A_new_save_has_no_progress()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var progress = await ProgressAsync(client, token);

        Assert.Empty(Flags(progress));
        Assert.Equal(0, progress.GetProperty("quests").GetArrayLength());
    }

    [Theory]
    [InlineData(MeadowMap, "mojca")]
    [InlineData("other_map", "vera")]
    public async Task Unknown_NPCs_are_not_found_and_change_nothing(string mapId, string npcId)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await TalkAsync(client, token, new { mapId, npcId });

        await AssertProblem(response, HttpStatusCode.NotFound, "unknown_npc");
        Assert.Equal(0, (await ProgressAsync(client, token)).GetProperty("quests").GetArrayLength());
    }

    [Fact]
    public async Task Requests_without_an_NPC_are_bad_requests()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await TalkAsync(client, token, new { mapId = MeadowMap });

        await AssertProblem(response, HttpStatusCode.BadRequest, "bad_request");
    }

    [Fact]
    public async Task Quests_require_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var talk = await TalkAsync(client, null, new { mapId = MeadowMap, npcId = "vera" });
        var progress = await ProgressAsync(client, null, HttpStatusCode.Unauthorized);

        await AssertProblem(talk, HttpStatusCode.Unauthorized, "invalid_save_token");
        Assert.Equal("invalid_save_token", progress.GetProperty("code").GetString());
    }

    [Fact]
    public async Task OpenApi_document_lists_the_quest_endpoints()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), Token);
        using var body = await ReadJsonAsync(response);
        var paths = body.RootElement.GetProperty("paths").EnumerateObject().Select(path => path.Name).ToList();

        Assert.Contains("/api/save/conversations", paths);
        Assert.Contains("/api/save/progress", paths);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }
}
