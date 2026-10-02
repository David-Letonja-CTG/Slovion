using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Slovion.IntegrationTests.Infrastructure;

/// <summary>Small helpers for calling the game API as a player would.</summary>
public static class GameApiClient
{
    public const string MeadowMap = "dravsko_polje_meadow";
    public const string SageSpot = "meadow_sage_1";

    public static async Task<string> CreateSaveAsync(HttpClient client)
    {
        using var response = await client.PostAsync(new Uri("/api/saves", UriKind.Relative), null, TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();
        using var body = await ReadJsonAsync(response);
        return body.RootElement.GetProperty("token").GetString()!;
    }

    public static Task<HttpResponseMessage> DiscoverAsync(
        HttpClient client,
        string? token,
        string mapId = MeadowMap,
        string spotId = SageSpot,
        string? acceptLanguage = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/discoveries", UriKind.Relative))
        {
            Content = JsonContent.Create(new { mapId, spotId }),
        };
        return SendAsync(client, request, token, acceptLanguage);
    }

    public static Task<HttpResponseMessage> GetNatureDexAsync(HttpClient client, string? token, string? acceptLanguage = null) =>
        SendAsync(client, new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/naturedex", UriKind.Relative)), token, acceptLanguage);

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
