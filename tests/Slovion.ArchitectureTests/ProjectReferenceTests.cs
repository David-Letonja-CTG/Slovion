using System.Xml.Linq;

namespace Slovion.ArchitectureTests;

/// <summary>
/// Checks declared project references. Complements <see cref="LayerDependencyTests"/>, because the
/// compiler drops references that no code uses yet, so type-level rules alone cannot see them.
/// </summary>
public class ProjectReferenceTests
{
    public static TheoryData<string, string[]> AllowedReferences => new()
    {
        { "Slovion.Domain", [] },
        { "Slovion.Application", ["Slovion.Domain"] },
        { "Slovion.Infrastructure", ["Slovion.Application", "Slovion.Domain"] },
        { "Slovion.Api", ["Slovion.Application", "Slovion.Domain", "Slovion.Infrastructure"] },
    };

    [Theory]
    [MemberData(nameof(AllowedReferences))]
    public void Project_references_only_allowed_layers(string project, string[] allowed)
    {
        var projectFile = Path.Combine(FindRepositoryRoot(), "src", project, $"{project}.csproj");

        var referenced = XDocument.Load(projectFile)
            .Descendants("ProjectReference")
            // Project files use Windows separators; normalize so the name is extracted on every OS.
            .Select(reference => Path.GetFileNameWithoutExtension(
                reference.Attribute("Include")!.Value.Replace('\\', '/')))
            .ToArray();

        var forbidden = referenced.Except(allowed).ToArray();
        Assert.True(forbidden.Length == 0, $"{project} must not reference: {string.Join(", ", forbidden)}");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Slovion.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Repository root (Slovion.slnx) not found.");
    }
}
