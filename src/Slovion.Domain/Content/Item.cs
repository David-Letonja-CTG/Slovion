namespace Slovion.Domain.Content;

/// <summary>A tool's texts in one language: game labels, never species facts.</summary>
public sealed record ItemText(string Name, string Description);

/// <summary>
/// A field tool the player can own: every save starts with it (<see cref="IsStart"/>) or a quest gives it. Its effect is
/// a gameplay rule keyed by its stable ID (docs/decisions.md D3, D7).
/// </summary>
public sealed record Item(string Id, bool IsStart, IReadOnlyDictionary<string, ItemText> Text);
