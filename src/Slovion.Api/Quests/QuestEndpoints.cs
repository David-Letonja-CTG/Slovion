using Slovion.Api.Content;
using Slovion.Api.Errors;
using Slovion.Api.Saves;
using Slovion.Application.Content;
using Slovion.Application.Quests;

namespace Slovion.Api.Quests;

public sealed record ConversationRequest(string? MapId, string? NpcId);

/// <summary>A quest as the player sees it. <c>Status</c> is <c>active</c> or <c>completed</c>.</summary>
public sealed record QuestResponse(string QuestId, string Title, string Summary, string ReturnHint, string Status, int Progress, int Goal);

/// <summary>What the NPC says, the quest's state afterwards, and the save's flags afterwards.</summary>
public sealed record ConversationResponse(string NpcName, IReadOnlyList<string> Lines, QuestResponse Quest, IReadOnlyList<string> Flags);

public sealed record ProgressResponse(IReadOnlyList<string> Flags, IReadOnlyList<QuestResponse> Quests);

public static class QuestEndpoints
{
    public static RouteGroupBuilder MapQuestEndpoints(this RouteGroupBuilder save)
    {
        save.MapPost("/conversations", Talk)
            .WithName("TalkToNpc")
            .Produces<ConversationResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        save.MapGet("/progress", GetProgress)
            .WithName("GetProgress")
            .Produces<ProgressResponse>();

        return save;
    }

    /// <summary>Talks to an NPC; the server decides the dialogue and every quest change (D3).</summary>
    private static async Task<IResult> Talk(ConversationRequest request, HttpContext httpContext, QuestService quests, IContentCatalog content, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.MapId) || string.IsNullOrWhiteSpace(request.NpcId))
        {
            return ErrorCodes.Problem(StatusCodes.Status400BadRequest, ErrorCodes.BadRequest);
        }

        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var result = await quests.TalkAsync(slot.Id, request.MapId, request.NpcId, language, cancellationToken);

        return result is TalkResult.Conversation conversation
            ? TypedResults.Ok(new ConversationResponse(conversation.NpcName, conversation.Lines, ToResponse(conversation.Quest), conversation.Flags))
            : ErrorCodes.Problem(StatusCodes.Status404NotFound, ErrorCodes.UnknownNpc);
    }

    private static async Task<IResult> GetProgress(HttpContext httpContext, QuestService quests, IContentCatalog content, CancellationToken cancellationToken)
    {
        var language = ContentLanguage.Negotiate(httpContext, content);
        var slot = SaveTokenFilter.CurrentSlot(httpContext);
        var progress = await quests.GetProgressAsync(slot.Id, language, cancellationToken);

        return TypedResults.Ok(new ProgressResponse(progress.Flags, progress.Quests.Select(ToResponse).ToList()));
    }

    private static QuestResponse ToResponse(QuestView quest) => new(
        quest.QuestId,
        quest.Title,
        quest.Summary,
        quest.ReturnHint,
        quest.Status == QuestStatus.Completed ? "completed" : "active",
        quest.Progress,
        quest.Goal);
}
