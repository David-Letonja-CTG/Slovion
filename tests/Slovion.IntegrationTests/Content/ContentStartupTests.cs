using System.Net;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Content;
using Slovion.IntegrationTests.Infrastructure;

namespace Slovion.IntegrationTests.Content;

public sealed class ContentStartupTests
{
    [Fact]
    public void Api_refuses_to_start_with_invalid_content()
    {
        using var content = new ContentFolder();
        content.Species["id"] = "Salvia-Pratensis";
        var settings = new Dictionary<string, string?> { [DependencyInjection.ContentRootPathSetting] = content.Write() };
        using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase, settings);

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        var validation = FindInner<ContentValidationException>(error);
        Assert.Contains(validation.Errors, message => message.Contains("invalid species ID 'Salvia-Pratensis'", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Api_starts_with_the_repository_content_copied_to_its_output()
    {
        await using var factory = new SlovionApiFactory(SlovionApiFactory.UnreachableDatabase);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        // Started (the database is deliberately unreachable here, so health is 503, not a startup crash).
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(File.Exists(Path.Combine(AppContext.BaseDirectory, "content", "species", "salvia_pratensis.json")));
    }

    private static T FindInner<T>(Exception error)
        where T : Exception
    {
        for (Exception? current = error; current is not null; current = current.InnerException)
        {
            if (current is T match)
            {
                return match;
            }
        }

        throw new Xunit.Sdk.XunitException($"No {typeof(T).Name} in exception chain: {error}");
    }
}
