using System.Net;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests;

[Collection(DatabaseCollectionDefinition.Name)]
public sealed class HealthWithDatabaseTests(PostgresFixture database)
{
    [Fact]
    public async Task Health_is_ok_when_database_is_reachable()
    {
        await using var factory = new SlovionApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

public sealed class HealthWithoutDatabaseTests
{
    [Fact]
    public async Task Health_is_unavailable_when_database_is_unreachable()
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }
}
