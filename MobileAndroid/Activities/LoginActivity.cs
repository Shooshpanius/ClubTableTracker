using Android.App;
using Android.Content;
using Android.OS;
using Android.Widget;
using MobileAndroid.Services;

namespace MobileAndroid.Activities
{
    [Activity(Label = "@string/app_name",
              MainLauncher = true,
              Theme = "@android:style/Theme.Material.NoActionBar")]
    public class LoginActivity : Activity
    {
        protected override void OnCreate(Bundle? savedInstanceState)
        {
            base.OnCreate(savedInstanceState);

            // Если токен уже сохранён — сразу переходим на главный экран
            var existing = TokenStorage.GetToken(this);
            if (!string.IsNullOrWhiteSpace(existing))
            {
                GoToMain();
                return;
            }

            SetContentView(Resource.Layout.activity_login);

            var editToken = FindViewById<EditText>(Resource.Id.editToken)!;
            var btnLogin  = FindViewById<Button>(Resource.Id.btnLogin)!;
            var tvError   = FindViewById<TextView>(Resource.Id.tvError)!;

            btnLogin.Click += (_, _) =>
            {
                var token = editToken.Text?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(token))
                {
                    tvError.Text = "Введите JWT-токен";
                    tvError.Visibility = Android.Views.ViewStates.Visible;
                    return;
                }
                tvError.Visibility = Android.Views.ViewStates.Gone;
                TokenStorage.SaveToken(this, token);
                GoToMain();
            };
        }

        private void GoToMain()
        {
            StartActivity(new Intent(this, typeof(MainActivity)));
            Finish();
        }
    }
}
