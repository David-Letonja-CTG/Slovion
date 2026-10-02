using System.Net;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests.Content;

public sealed class ContentFilesTests
{
    [Theory]
    [InlineData("/content/maps/dravsko_polje_meadow.json", "application/json")]
    [InlineData("/content/tilesets/meadow.png", "image/png")]
    public async Task Maps_and_tilesets_are_served(string path, string mediaType)
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(mediaType, response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("/content/species/salvia_pratensis.json")]
    [InlineData("/content/maps/../species/salvia_pratensis.json")]
    public async Task Species_files_are_not_served_raw(string path)
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
