using Microsoft.Extensions.FileProviders;
using Slovion.Infrastructure;
using Slovion.Infrastructure.Content;

namespace Slovion.Api.Content;

public static class ContentFilesSetup
{
    /// <summary>Folders of the content root that clients may download as-is.</summary>
    private static readonly string[] PublicFolders = ["maps", "tilesets", FileContentCatalog.PicturesFolder, FileContentCatalog.AreasFolder];

    /// <summary>
    /// Serves maps, tilesets, species pictures and area names as static files under <c>/content</c>. Species files are deliberately not
    /// served: players receive species text only through localized endpoints (docs/decisions.md D7).
    /// </summary>
    public static IApplicationBuilder UsePublicContentFiles(this WebApplication app)
    {
        var root = DependencyInjection.ContentRootPath(app.Configuration);
        foreach (var folder in PublicFolders)
        {
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(Path.Combine(root, folder)),
                RequestPath = $"/content/{folder}",
            });
        }

        return app;
    }
}
