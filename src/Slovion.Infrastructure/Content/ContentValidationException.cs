namespace Slovion.Infrastructure.Content;

/// <summary>Content is invalid. Lists every problem found, not just the first.</summary>
public sealed class ContentValidationException(IReadOnlyList<string> errors)
    : Exception($"Content is invalid:{Environment.NewLine}- {string.Join(Environment.NewLine + "- ", errors)}")
{
    public IReadOnlyList<string> Errors { get; } = errors;
}
