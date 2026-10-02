using System.Security.Cryptography;
using System.Text;

namespace Slovion.Application.Saves;

/// <summary>The secret that identifies an anonymous save slot (docs/decisions.md D4).</summary>
public static class SaveToken
{
    private const int TokenBytes = 32; // 256 bits

    /// <summary>A new random token, base64url-encoded so it is safe in headers.</summary>
    public static string Generate() => Base64UrlEncode(RandomNumberGenerator.GetBytes(TokenBytes));

    /// <summary>
    /// SHA-256 of the token. Only the hash is stored, so stored data cannot be turned back into a token.
    /// A slow password hash is unnecessary because tokens are random 256-bit secrets.
    /// </summary>
    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
