namespace Slovion.Api.Errors;

/// <summary>
/// Stable, machine-readable error codes returned in the problem-details <c>code</c> extension.
/// The client maps codes to translation keys; the API never returns player-facing prose.
/// </summary>
public static class ErrorCodes
{
    public const string ExtensionName = "code";

    public const string BadRequest = "bad_request";
    public const string NotFound = "not_found";
    public const string MethodNotAllowed = "method_not_allowed";
    public const string Conflict = "conflict";
    public const string InternalError = "internal_error";
    public const string Unknown = "error";

    public static string FromStatusCode(int? statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => BadRequest,
        StatusCodes.Status404NotFound => NotFound,
        StatusCodes.Status405MethodNotAllowed => MethodNotAllowed,
        StatusCodes.Status409Conflict => Conflict,
        >= 500 => InternalError,
        _ => Unknown,
    };
}
