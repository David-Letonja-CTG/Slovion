using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using Slovion.Application.Content;
using Slovion.Domain.World;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class WeatherTests(PostgresFixture database)
{
    private readonly FakeTimeProvider clock = new(new DateTimeOffset(2026, 6, 1, 8, 0, 0, TimeSpan.Zero));

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private SlovionApiFactory Factory() =>
        new(database.ConnectionString, configureServices: services => services.AddSingleton<TimeProvider>(clock));

    private static async Task<(HttpStatusCode Status, JsonElement Body)> WeatherAsync(HttpClient client, string? token, string? mapId)
    {
        var query = mapId is null ? string.Empty : $"?mapId={mapId}";
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri($"/api/save/weather{query}", UriKind.Relative));
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Token);
        using var body = await ReadJsonAsync(response);
        return (response.StatusCode, body.RootElement.Clone());
    }

    [Fact]
    public async Task The_weather_is_the_region_s_and_changes_at_the_next_period()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        var kocevje = factory.Services.GetRequiredService<IContentCatalog>().FindRegion("kocevje")!;

        var (status, body) = await WeatherAsync(client, token, "kocevje_forest");

        // A new save is at day 1, 08:00: the period 06:00–11:59, which changes at 12:00 (720 minutes from day 1 00:00).
        Assert.Equal(HttpStatusCode.OK, status);
        var expected = kocevje.WeatherAt(new WorldTime(WorldTime.StartMinutes)).ToString().ToLowerInvariant();
        Assert.Equal((expected, 720L), (body.GetProperty("weather").GetString(), body.GetProperty("changesAtMinutes").GetInt64()));

        clock.Advance(TimeSpan.FromSeconds(240)); // 12:00
        var (_, afternoon) = await WeatherAsync(client, token, "kocevje_forest");
        Assert.Equal(1080L, afternoon.GetProperty("changesAtMinutes").GetInt64());
        Assert.Equal(kocevje.WeatherAt(new WorldTime(720)).ToString().ToLowerInvariant(), afternoon.GetProperty("weather").GetString());
    }

    [Theory]
    [InlineData("nowhere", HttpStatusCode.NotFound, "unknown_map")]
    [InlineData(null, HttpStatusCode.BadRequest, "bad_request")]
    public async Task Invalid_maps_are_rejected(string? mapId, HttpStatusCode expected, string code)
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        var (status, body) = await WeatherAsync(client, token, mapId);

        Assert.Equal((expected, code), (status, body.GetProperty("code").GetString()));
    }

    [Fact]
    public async Task Reading_the_weather_needs_a_save_token()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient();

        var (status, body) = await WeatherAsync(client, null, "kocevje_forest");

        Assert.Equal((HttpStatusCode.Unauthorized, "invalid_save_token"), (status, body.GetProperty("code").GetString()));
    }
}
