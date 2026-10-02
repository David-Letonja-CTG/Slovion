using System.Net;
using System.Text.Json;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests;

public sealed class OpenApiTests
{
    [Fact]
    public async Task OpenApi_document_is_served_in_development()
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), cancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        Assert.StartsWith("3.", document.RootElement.GetProperty("openapi").GetString(), StringComparison.Ordinal);
    }
}
