using System.Net;
using System.Text.Json;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests;

public sealed class ErrorResponseTests
{
    [Fact]
    public async Task Unknown_api_route_returns_not_found_problem_with_code()
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/api/does-not-exist", UriKind.Relative), cancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        Assert.Equal("not_found", body.RootElement.GetProperty("code").GetString());
    }
}
