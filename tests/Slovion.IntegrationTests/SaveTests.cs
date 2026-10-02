using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Slovion.Application.Saves;
using Slovion.Infrastructure.Persistence;
using Slovion.IntegrationTests.Infrastructure;
using static Slovion.IntegrationTests.Infrastructure.GameApiClient;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class SaveTests(PostgresFixture database)
{
    [Fact]
    public async Task New_game_returns_201_with_a_256_bit_token()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(new Uri("/api/saves", UriKind.Relative), null, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        var token = body.RootElement.GetProperty("token").GetString()!;
        Assert.Matches("^[A-Za-z0-9_-]{43}$", token); // 32 bytes, base64url without padding
    }

    [Fact]
    public async Task Each_new_game_gets_a_different_token_and_an_empty_naturedex()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        var first = await CreateSaveAsync(client);
        var second = await CreateSaveAsync(client);
        await IdentifyAsync(client, first, SageSpot, Sage);
        using var secondDex = await GetNatureDexAsync(client, second);

        Assert.NotEqual(first, second);
        using var body = await ReadJsonAsync(secondDex);
        Assert.Equal(0, body.RootElement.GetProperty("entries").GetArrayLength());
    }

    [Fact]
    public async Task Only_the_token_hash_is_stored()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SlovionDbContext>();
        var cancellationToken = TestContext.Current.CancellationToken;

        var hash = SaveToken.Hash(token);
        var plain = Encoding.UTF8.GetBytes(token);

        Assert.True(await db.SaveSlots.AnyAsync(slot => slot.TokenHash == hash, cancellationToken));
        Assert.False(await db.SaveSlots.AnyAsync(slot => slot.TokenHash == plain, cancellationToken));
    }

    [Theory]
    [InlineData(null)] // no header
    [InlineData("Bearer not-a-real-token")] // unknown token
    [InlineData("Basic dXNlcjpwYXNz")] // wrong scheme
    [InlineData("Bearer ")] // empty token
    public async Task Missing_or_unknown_tokens_are_rejected(string? authorization)
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        foreach (var request in new[]
                 {
                     new HttpRequestMessage(HttpMethod.Get, new Uri("/api/save/naturedex", UriKind.Relative)),
                     new HttpRequestMessage(HttpMethod.Post, new Uri("/api/save/encounters", UriKind.Relative))
                     {
                         Content = new StringContent("""{"mapId":"dravsko_polje_meadow","spotId":"meadow_sage_1"}""", Encoding.UTF8, "application/json"),
                     },
                     new HttpRequestMessage(HttpMethod.Post, new Uri($"/api/save/encounters/{Guid.NewGuid()}/identification", UriKind.Relative))
                     {
                         Content = new StringContent("""{"speciesId":"salvia_pratensis"}""", Encoding.UTF8, "application/json"),
                     },
                 })
        {
            if (authorization is not null)
            {
                request.Headers.TryAddWithoutValidation("Authorization", authorization);
            }

            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            using var body = await ReadJsonAsync(response);
            Assert.Equal("invalid_save_token", body.RootElement.GetProperty("code").GetString());
            request.Dispose();
        }
    }

    [Fact]
    public async Task Token_is_accepted_only_in_the_authorization_header()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var token = await CreateSaveAsync(client);

        using var response = await client.GetAsync(new Uri($"/api/save/naturedex?token={token}", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var authorized = await client.GetAsync(new Uri("/api/save/naturedex", UriKind.Relative), TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, authorized.StatusCode);
    }
}
