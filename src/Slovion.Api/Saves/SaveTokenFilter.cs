using System.Net.Http.Headers;
using Microsoft.Net.Http.Headers;
using Slovion.Api.Errors;
using Slovion.Application.Saves;
using Slovion.Domain.Saves;

namespace Slovion.Api.Saves;

/// <summary>
/// Resolves the save slot from <c>Authorization: Bearer</c>. The token never appears in URLs and is
/// never logged (docs/decisions.md D4, D5).
/// </summary>
public sealed class SaveTokenFilter(SaveSlotService saveSlots) : IEndpointFilter
{
    private const string SlotItemKey = "Slovion.SaveSlot";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var httpContext = context.HttpContext;
        var header = httpContext.Request.Headers[HeaderNames.Authorization].ToString();

        var slot = AuthenticationHeaderValue.TryParse(header, out var value)
                   && string.Equals(value.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)
                   && !string.IsNullOrWhiteSpace(value.Parameter)
            ? await saveSlots.ResolveAsync(value.Parameter, httpContext.RequestAborted)
            : null;

        if (slot is null)
        {
            return ErrorCodes.Problem(StatusCodes.Status401Unauthorized, ErrorCodes.InvalidSaveToken);
        }

        httpContext.Items[SlotItemKey] = slot;
        return await next(context);
    }

    public static SaveSlot CurrentSlot(HttpContext httpContext) =>
        httpContext.Items[SlotItemKey] as SaveSlot
        ?? throw new InvalidOperationException($"{nameof(SaveTokenFilter)} did not run for this endpoint.");
}
