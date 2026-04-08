using Android.Content;

namespace MobileAndroid.Services
{
    public static class TokenStorage
    {
        private const string PrefsName = "ClubTablePrefs";
        private const string TokenKey  = "jwt_token";

        public static void SaveToken(Context context, string token)
        {
            var prefs = context.GetSharedPreferences(PrefsName, FileCreationMode.Private)!;
            prefs.Edit()!.PutString(TokenKey, token)!.Apply();
        }

        public static string? GetToken(Context context)
        {
            var prefs = context.GetSharedPreferences(PrefsName, FileCreationMode.Private)!;
            return prefs.GetString(TokenKey, null);
        }

        public static void ClearToken(Context context)
        {
            var prefs = context.GetSharedPreferences(PrefsName, FileCreationMode.Private)!;
            prefs.Edit()!.Remove(TokenKey)!.Apply();
        }
    }
}
