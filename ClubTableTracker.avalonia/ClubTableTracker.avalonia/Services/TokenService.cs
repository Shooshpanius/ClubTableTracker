using System;
using System.IO;

namespace ClubTableTracker.avalonia.Services;

public class TokenService
{
    private static readonly string TokenFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "ClubTableTracker",
        "token.txt");

    private string? _cachedToken;

    // TODO: upgrade to platform-specific secure storage
    // (e.g. Windows Credential Manager, Android Keystore, iOS Keychain)
    // for production use to protect the JWT token at rest.

    public string? GetToken()
    {
        if (_cachedToken != null) return _cachedToken;
        try
        {
            if (File.Exists(TokenFilePath))
                _cachedToken = File.ReadAllText(TokenFilePath).Trim();
        }
        catch { }
        return _cachedToken;
    }

    public void SaveToken(string token)
    {
        _cachedToken = token;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(TokenFilePath)!);
            File.WriteAllText(TokenFilePath, token);
        }
        catch { }
    }

    public void ClearToken()
    {
        _cachedToken = null;
        try { if (File.Exists(TokenFilePath)) File.Delete(TokenFilePath); } catch { }
    }

    public bool HasToken() => !string.IsNullOrEmpty(GetToken());
}
