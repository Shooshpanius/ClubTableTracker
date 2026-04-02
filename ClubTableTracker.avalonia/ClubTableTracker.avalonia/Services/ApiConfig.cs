namespace ClubTableTracker.avalonia.Services;

public static class ApiConfig
{
    // All requests go through the nginx reverse proxy at club.wh40kcards.ru
    // nginx routes /api/* to the backend container (back40club:8080)
    public const string BaseUrl = "https://club.wh40kcards.ru/api";
}
