using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Slovion.IntegrationTests.Infrastructure;

/// <summary>Small helpers for calling the game API as a player would.</summary>
public static class GameApiClient
{
    public const string MeadowMap = "dravsko_polje_meadow";
    public const string SageSpot = "meadow_sage_1";
    public const string Sage = "salvia_pratensis";
    public const string HareSpot = "meadow_hare_1";
    public const string Hare = "lepus_europaeus";
    public const string SkylarkSpot = "meadow_skylark_1";

    public static async Task<string> CreateSaveAsync(HttpClient client)
    {
        using var response = await client.PostAsync(new Uri("/api/saves", UriKind.Relative), null, TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();
        using var body = await ReadJsonAsync(response);
        return body.RootElement.GetProperty("token").GetString()!;
    }

    public static Task<HttpResponseMessage> StartEncounterAsync(
        HttpClient client,
        string? token,
        string spotId = SageSpot,
        string mapId = MeadowMap,
        string? acceptLanguage = null) =>
        SendAsync(
            client,
            new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/encounters", UriKind.Relative))
            {
                Content = JsonContent.Create(new { mapId, spotId }),
            },
            token,
            acceptLanguage);

    public static Task<HttpResponseMessage> AnswerAsync(HttpClient client, string? token, Guid encounterId, string speciesId) =>
        SendAsync(
            client,
            new HttpRequestMessage(HttpMethod.Post, new Uri($"/api/save/encounters/{encounterId}/identification", UriKind.Relative))
            {
                Content = JsonContent.Create(new { speciesId }),
            },
            token,
            acceptLanguage: null);

    /// <summary>Starts an encounter (expecting 201) and returns its ID.</summary>
    public static async Task<Guid> OpenEncounterAsync(HttpClient client, string token, string spotId = SageSpot)
    {
        using var response = await StartEncounterAsync(client, token, spotId);
        Assert.Equal(System.Net.HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        return body.RootElement.GetProperty("encounterId").GetGuid();
    }

    /// <summary>Observes and correctly identifies the species at a spot.</summary>
    public static async Task IdentifyAsync(HttpClient client, string token, string spotId, string speciesId)
    {
        var encounterId = await OpenEncounterAsync(client, token, spotId);
        using var answer = await AnswerAsync(client, token, encounterId, speciesId);
        answer.EnsureSuccessStatusCode();
    }

    public static Task<HttpResponseMessage> GetNatureDexAsync(HttpClient client, string? token, string? acceptLanguage = null) =>
        SendAsync(client, new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/naturedex", UriKind.Relative)), token, acceptLanguage);

    public static async Task<JsonElement[]> NatureDexEntriesAsync(HttpClient client, string token)
    {
        using var response = await GetNatureDexAsync(client, token);
        response.EnsureSuccessStatusCode();
        using var body = await ReadJsonAsync(response);
        return body.RootElement.GetProperty("entries").EnumerateArray().Select(entry => entry.Clone()).ToArray();
    }

    public static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, HttpRequestMessage request, string? token, string? acceptLanguage)
    {
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        if (acceptLanguage is not null)
        {
            request.Headers.AcceptLanguage.ParseAdd(acceptLanguage);
        }

        return client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
