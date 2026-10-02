using Microsoft.Net.Http.Headers;
using Slovion.Application.Content;

namespace Slovion.Api.Content;

public static class ContentLanguage
{
    /// <summary>
    /// The best content language for the request: the highest-quality <c>Accept-Language</c> entry the
    /// content provides (matching on the primary subtag, so <c>sl-SI</c> means <c>sl</c>), else Slovenian.
    /// Also sets the <c>Content-Language</c> response header.
    /// </summary>
    public static string Negotiate(HttpContext httpContext, IContentCatalog content)
    {
        var chosen = httpContext.Request.GetTypedHeaders().AcceptLanguage
            .Where(entry => entry.Quality is not 0)
            .OrderByDescending(entry => entry.Quality ?? 1)
            .Select(entry => entry.Value.Value?.Split('-')[0].ToLowerInvariant())
            .FirstOrDefault(language => language is not null && content.Languages.Contains(language))
            ?? IContentCatalog.DefaultLanguage;

        httpContext.Response.Headers[HeaderNames.ContentLanguage] = chosen;
        return chosen;
    }
}
