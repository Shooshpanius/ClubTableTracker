using System;
using System.Collections.Generic;
using System.Linq;
using Android.App;
using Android.Content;
using Android.Graphics;
using Android.OS;
using Android.Views;
using Android.Widget;
using MobileAndroid.Activities;
using MobileAndroid.Models;
using MobileAndroid.Services;

namespace MobileAndroid
{
    [Activity(Label = "@string/app_name",
              Theme = "@android:style/Theme.Material.NoActionBar")]
    public class MainActivity : Activity
    {
        private ApiService? _api;
        private FrameLayout? _contentFrame;
        private Button? _tabClubs, _tabBookings, _tabLog, _tabProfile, _tabDebug;
        private int _currentTab = -1;

        private static readonly string[] GameSystems =
        {
            "Warhammer 40,000", "Age of Sigmar", "The Horus Heresy", "Necromunda",
            "Blood Bowl", "Warhammer Underworlds", "Kill Team", "Warcry",
            "Middle-earth Strategy Battle Game", "The Old World", "Bushido",
            "Battlefleet Gothic", "Saga", "Trench Crusade", "Battletech",
            "Mordheim", "Покрас", "Настольные игры"
        };

        protected override void OnCreate(Bundle? savedInstanceState)
        {
            base.OnCreate(savedInstanceState);
            SetContentView(Resource.Layout.activity_main);

            var token = TokenStorage.GetToken(this) ?? "";
            _api = new ApiService(token);

            _contentFrame = FindViewById<FrameLayout>(Resource.Id.contentFrame)!;
            _tabClubs    = FindViewById<Button>(Resource.Id.tabClubs)!;
            _tabBookings = FindViewById<Button>(Resource.Id.tabBookings)!;
            _tabLog      = FindViewById<Button>(Resource.Id.tabLog)!;
            _tabProfile  = FindViewById<Button>(Resource.Id.tabProfile)!;
            _tabDebug    = FindViewById<Button>(Resource.Id.tabDebug)!;

            _tabClubs.Click    += (_, _) => SelectTab(0);
            _tabBookings.Click += (_, _) => SelectTab(1);
            _tabLog.Click      += (_, _) => SelectTab(2);
            _tabProfile.Click  += (_, _) => SelectTab(3);
            _tabDebug.Click    += (_, _) => SelectTab(4);

            SelectTab(0);
        }

        private void SelectTab(int index)
        {
            if (_currentTab == index) return;
            _currentTab = index;
            UpdateTabHighlight(index);
            _contentFrame!.RemoveAllViews();
            switch (index)
            {
                case 0: LoadClubsTab();    break;
                case 1: LoadBookingsTab(); break;
                case 2: LoadLogTab();      break;
                case 3: LoadProfileTab();  break;
                case 4: LoadDebugTab();    break;
            }
        }

        private void UpdateTabHighlight(int selected)
        {
            var tabs = new[] { _tabClubs!, _tabBookings!, _tabLog!, _tabProfile!, _tabDebug! };
            for (int i = 0; i < tabs.Length; i++)
                tabs[i].SetBackgroundColor(Color.ParseColor(i == selected ? "#e94560" : "#16213e"));
        }

        // ─── Clubs Tab ───────────────────────────────────────────────────────────

        private void LoadClubsTab()
        {
            var view    = LayoutInflater!.Inflate(Resource.Layout.fragment_clubs, _contentFrame, false)!;
            _contentFrame!.AddView(view);

            var progress = view.FindViewById<ProgressBar>(Resource.Id.progressClubs)!;
            var empty    = view.FindViewById<TextView>(Resource.Id.tvClubsEmpty)!;
            var list     = view.FindViewById<ListView>(Resource.Id.listClubs)!;

            _ = System.Threading.Tasks.Task.Run(async () =>
            {
                var clubs       = await _api!.GetClubsAsync();
                var memberships = await _api.GetMembershipsAsync();

                RunOnUiThread(() =>
                {
                    progress.Visibility = ViewStates.Gone;

                    if (clubs == null || clubs.Count == 0)
                    {
                        empty.Visibility = ViewStates.Visible;
                        return;
                    }

                    var items = clubs.Select(c => new ClubItem
                    {
                        Club       = c,
                        Membership = memberships?.FirstOrDefault(m => m.Club.Id == c.Id)
                    }).ToList();

                    list.Visibility = ViewStates.Visible;
                    list.Adapter = new ClubAdapter(this, items, async clubId =>
                    {
                        var ok = await _api.ApplyForMembershipAsync(clubId);
                        RunOnUiThread(() =>
                        {
                            Toast.MakeText(this,
                                ok ? "Заявка подана!" : "Не удалось подать заявку",
                                ToastLength.Short)!.Show();
                            if (ok)
                            {
                                // Перезагрузить вкладку
                                _currentTab = -1;
                                SelectTab(0);
                            }
                        });
                    });
                });
            });
        }

        // ─── Bookings Tab ────────────────────────────────────────────────────────

        private void LoadBookingsTab()
        {
            var view    = LayoutInflater!.Inflate(Resource.Layout.fragment_bookings, _contentFrame, false)!;
            _contentFrame!.AddView(view);

            var progress = view.FindViewById<ProgressBar>(Resource.Id.progressBookings)!;
            var empty    = view.FindViewById<TextView>(Resource.Id.tvBookingsEmpty)!;
            var list     = view.FindViewById<ListView>(Resource.Id.listBookings)!;

            _ = System.Threading.Tasks.Task.Run(async () =>
            {
                var bookings = await _api!.GetMyUpcomingBookingsAsync();

                RunOnUiThread(() =>
                {
                    progress.Visibility = ViewStates.Gone;
                    if (bookings == null || bookings.Count == 0)
                    {
                        empty.Visibility = ViewStates.Visible;
                        return;
                    }
                    list.Visibility = ViewStates.Visible;
                    list.Adapter = new BookingAdapter(this, bookings);
                });
            });
        }

        // ─── Log Tab ─────────────────────────────────────────────────────────────

        private void LoadLogTab()
        {
            var view    = LayoutInflater!.Inflate(Resource.Layout.fragment_log, _contentFrame, false)!;
            _contentFrame!.AddView(view);

            var progress = view.FindViewById<ProgressBar>(Resource.Id.progressLog)!;
            var empty    = view.FindViewById<TextView>(Resource.Id.tvLogEmpty)!;
            var list     = view.FindViewById<ListView>(Resource.Id.listLog)!;

            _ = System.Threading.Tasks.Task.Run(async () =>
            {
                var entries = await _api!.GetActivityLogAsync();

                RunOnUiThread(() =>
                {
                    progress.Visibility = ViewStates.Gone;
                    if (entries == null || entries.Count == 0)
                    {
                        empty.Visibility = ViewStates.Visible;
                        return;
                    }
                    list.Visibility = ViewStates.Visible;
                    list.Adapter = new LogAdapter(this, entries);
                });
            });
        }

        // ─── Debug Tab ───────────────────────────────────────────────────────────

        private void LoadDebugTab()
        {
            var view  = LayoutInflater!.Inflate(Resource.Layout.fragment_debug, _contentFrame, false)!;
            _contentFrame!.AddView(view);

            var empty = view.FindViewById<TextView>(Resource.Id.tvDebugEmpty)!;
            var list  = view.FindViewById<ListView>(Resource.Id.listDebug)!;

            var entries = RequestLogger.GetAll();
            if (entries.Count == 0)
            {
                empty.Visibility = ViewStates.Visible;
            }
            else
            {
                list.Visibility = ViewStates.Visible;
                list.Adapter = new DebugLogAdapter(this, entries);
            }
        }

        // ─── Profile Tab ─────────────────────────────────────────────────────────

        private void LoadProfileTab()
        {
            var view = LayoutInflater!.Inflate(Resource.Layout.fragment_profile, _contentFrame, false)!;
            _contentFrame!.AddView(view);

            var tvGoogleName    = view.FindViewById<TextView>(Resource.Id.tvGoogleName)!;
            var editDisplayName = view.FindViewById<EditText>(Resource.Id.editDisplayName)!;
            var btnSaveName     = view.FindViewById<Button>(Resource.Id.btnSaveName)!;
            var tvNameStatus    = view.FindViewById<TextView>(Resource.Id.tvNameStatus)!;

            var editBio     = view.FindViewById<EditText>(Resource.Id.editBio)!;
            var btnSaveBio  = view.FindViewById<Button>(Resource.Id.btnSaveBio)!;
            var tvBioStatus = view.FindViewById<TextView>(Resource.Id.tvBioStatus)!;

            var tvGameSystemsList  = view.FindViewById<TextView>(Resource.Id.tvGameSystemsList)!;
            var btnEditGameSystems = view.FindViewById<Button>(Resource.Id.btnEditGameSystems)!;
            var btnLogout          = view.FindViewById<Button>(Resource.Id.btnLogout)!;

            var selectedSystems = new List<string>();

            // Загружаем профиль
            _ = System.Threading.Tasks.Task.Run(async () =>
            {
                var profile = await _api!.GetUserMeAsync();
                RunOnUiThread(() =>
                {
                    if (profile == null)
                    {
                        Toast.MakeText(this, "Не удалось загрузить профиль", ToastLength.Short)!.Show();
                        return;
                    }
                    tvGoogleName.Text    = profile.Name;
                    editDisplayName.Text = profile.DisplayName ?? "";
                    editBio.Text         = profile.Bio ?? "";

                    selectedSystems.Clear();
                    if (!string.IsNullOrEmpty(profile.EnabledGameSystems))
                        selectedSystems.AddRange(profile.EnabledGameSystems.Split('|').Where(s => !string.IsNullOrEmpty(s)));

                    tvGameSystemsList.Text = selectedSystems.Count > 0
                        ? string.Join(", ", selectedSystems)
                        : "Не выбраны";
                });
            });

            // Сохранить имя
            btnSaveName.Click += (_, _) =>
            {
                var name = editDisplayName.Text?.Trim();
                _ = System.Threading.Tasks.Task.Run(async () =>
                {
                    var ok = await _api!.UpdateDisplayNameAsync(string.IsNullOrEmpty(name) ? null : name);
                    RunOnUiThread(() =>
                    {
                        tvNameStatus.Text      = ok ? "✓ Сохранено" : "Ошибка при сохранении";
                        tvNameStatus.SetTextColor(Color.ParseColor(ok ? "#4caf50" : "#e94560"));
                        tvNameStatus.Visibility = ViewStates.Visible;
                    });
                });
            };

            // Сохранить биографию
            btnSaveBio.Click += (_, _) =>
            {
                var bio = editBio.Text?.Trim();
                _ = System.Threading.Tasks.Task.Run(async () =>
                {
                    var ok = await _api!.UpdateBioAsync(string.IsNullOrEmpty(bio) ? null : bio);
                    RunOnUiThread(() =>
                    {
                        tvBioStatus.Text      = ok ? "✓ Сохранено" : "Ошибка при сохранении";
                        tvBioStatus.SetTextColor(Color.ParseColor(ok ? "#4caf50" : "#e94560"));
                        tvBioStatus.Visibility = ViewStates.Visible;
                    });
                });
            };

            // Редактировать игровые системы
            btnEditGameSystems.Click += (_, _) =>
            {
                var checkedItems = GameSystems.Select(gs => selectedSystems.Contains(gs)).ToArray();
                var builder = new AlertDialog.Builder(this)!;
                builder.SetTitle("Игровые системы");
                builder.SetMultiChoiceItems(GameSystems, checkedItems,
                    (_, args) =>
                    {
                        if (args.IsChecked)
                        {
                            if (!selectedSystems.Contains(GameSystems[args.Which]))
                                selectedSystems.Add(GameSystems[args.Which]);
                        }
                        else
                        {
                            selectedSystems.Remove(GameSystems[args.Which]);
                        }
                    });
                builder.SetPositiveButton("OK", async (_, _) =>
                {
                    tvGameSystemsList.Text = selectedSystems.Count > 0
                        ? string.Join(", ", selectedSystems)
                        : "Не выбраны";
                    var ok = await _api!.UpdateGameSystemsAsync(new List<string>(selectedSystems));
                    RunOnUiThread(() =>
                        Toast.MakeText(this,
                            ok ? "Игровые системы сохранены" : "Ошибка при сохранении",
                            ToastLength.Short)!.Show());
                });
                builder.SetNegativeButton("Отмена", (Android.Content.IDialogInterfaceOnClickListener?)null);
                builder.Show();
            };

            // Выход
            btnLogout.Click += (_, _) =>
            {
                TokenStorage.ClearToken(this);
                var intent = new Intent(this, typeof(LoginActivity));
                intent.AddFlags(ActivityFlags.ClearTop | ActivityFlags.NewTask);
                StartActivity(intent);
                Finish();
            };
        }

        // ─── Helpers ─────────────────────────────────────────────────────────────

        private static string FormatDateTime(string iso)
        {
            if (DateTime.TryParse(iso, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
                return dt.ToLocalTime().ToString("dd.MM.yyyy HH:mm");
            return iso;
        }

        private static string FormatDateTimeRange(string start, string end)
        {
            if (DateTime.TryParse(start, null, System.Globalization.DateTimeStyles.RoundtripKind, out var s) &&
                DateTime.TryParse(end,   null, System.Globalization.DateTimeStyles.RoundtripKind, out var e))
            {
                var ls = s.ToLocalTime();
                var le = e.ToLocalTime();
                if (ls.Date == le.Date)
                    return $"{ls:dd.MM.yyyy} {ls:HH:mm}–{le:HH:mm}";
                return $"{ls:dd.MM.yyyy HH:mm} – {le:dd.MM.yyyy HH:mm}";
            }
            return $"{start} – {end}";
        }

        private static string GetActionLabel(string action) => action switch
        {
            "Booked"     => "зарезервировал стол",
            "Joined"     => "присоединился к игре",
            "Left"       => "вышел из игры",
            "Cancelled"  => "отменил бронирование",
            "MovedTable" => "перенёс игру",
            "Rescheduled"=> "изменил время",
            _            => action
        };

        // ─── Inner Types ─────────────────────────────────────────────────────────

        public class ClubItem
        {
            public Club       Club       { get; set; } = null!;
            public Membership? Membership { get; set; }
        }

        private class ClubAdapter : BaseAdapter<ClubItem>
        {
            private readonly Activity _ctx;
            private readonly List<ClubItem> _items;
            private readonly Func<int, System.Threading.Tasks.Task> _onApply;

            public ClubAdapter(Activity ctx, List<ClubItem> items,
                               Func<int, System.Threading.Tasks.Task> onApply)
            {
                _ctx    = ctx;
                _items  = items;
                _onApply = onApply;
            }

            public override int Count => _items.Count;
            public override ClubItem this[int position] => _items[position];
            public override long GetItemId(int position) => position;

            public override View GetView(int position, View? convertView, ViewGroup parent)
            {
                var view = convertView
                    ?? LayoutInflater.From(_ctx)!.Inflate(Resource.Layout.item_club, parent, false)!;

                var item = _items[position];

                view.FindViewById<TextView>(Resource.Id.tvClubName)!.Text =
                    item.Club.Name;
                view.FindViewById<TextView>(Resource.Id.tvClubHours)!.Text =
                    $"🕐 {item.Club.OpenTime}–{item.Club.CloseTime}";
                view.FindViewById<TextView>(Resource.Id.tvClubDesc)!.Text =
                    item.Club.Description;

                var tvStatus  = view.FindViewById<TextView>(Resource.Id.tvMemberStatus)!;
                var btnApply  = view.FindViewById<Button>(Resource.Id.btnApply)!;
                btnApply.Tag = null;

                if (item.Membership == null)
                {
                    tvStatus.Text      = "";
                    tvStatus.Visibility = ViewStates.Gone;
                    btnApply.Visibility = ViewStates.Visible;
                    btnApply.Enabled    = true;
                    btnApply.Tag        = new Java.Lang.Integer(item.Club.Id);
                    btnApply.Click -= OnApplyClick;
                    btnApply.Click += OnApplyClick;
                }
                else
                {
                    btnApply.Visibility = ViewStates.Gone;
                    tvStatus.Visibility  = ViewStates.Visible;
                    (tvStatus.Text, var color) = item.Membership.Status switch
                    {
                        "Approved" => ("✓ Участник",             "#4caf50"),
                        "Pending"  => ("🕐 Заявка на рассмотрении", "#ffc107"),
                        "Rejected" => ("✗ Заявка отклонена",     "#e94560"),
                        "Kicked"   => ("🚫 Исключён",            "#e94560"),
                        _          => (item.Membership.Status,   "#aaaaaa")
                    };
                    tvStatus.SetTextColor(Color.ParseColor(color));
                }
                return view;
            }

            private void OnApplyClick(object? sender, EventArgs e)
            {
                if (sender is Button btn && btn.Tag is Java.Lang.Integer id)
                {
                    btn.Enabled = false;
                    _ = _onApply(id.IntValue());
                }
            }
        }

        private class BookingAdapter : BaseAdapter<UpcomingBooking>
        {
            private readonly Activity            _ctx;
            private readonly List<UpcomingBooking> _items;

            public BookingAdapter(Activity ctx, List<UpcomingBooking> items)
            { _ctx = ctx; _items = items; }

            public override int Count => _items.Count;
            public override UpcomingBooking this[int position] => _items[position];
            public override long GetItemId(int position) => position;

            public override View GetView(int position, View? convertView, ViewGroup parent)
            {
                var view = convertView
                    ?? LayoutInflater.From(_ctx)!.Inflate(Resource.Layout.item_booking, parent, false)!;

                var b = _items[position];

                view.FindViewById<TextView>(Resource.Id.tvTableClub)!.Text =
                    $"Стол №{b.TableNumber} · {b.ClubName}";
                view.FindViewById<TextView>(Resource.Id.tvGameSystem)!.Text =
                    b.GameSystem ?? "";
                view.FindViewById<TextView>(Resource.Id.tvDateTime)!.Text =
                    FormatDateTimeRange(b.StartTime, b.EndTime);

                var realParticipants = b.Participants
                    .Where(p => p.Id != "__RESERVED__" && p.Status != "Invited")
                    .Select(p => p.Name)
                    .ToList();
                var allPlayers = new List<string> { b.User.Name };
                allPlayers.AddRange(realParticipants);
                view.FindViewById<TextView>(Resource.Id.tvPlayers)!.Text =
                    $"Игроки: {string.Join(", ", allPlayers)}";

                var tvMode = view.FindViewById<TextView>(Resource.Id.tvMode)!;
                if (b.IsDoubles)
                {
                    tvMode.Text       = "🎲 Doubles (4 игрока)";
                    tvMode.Visibility  = ViewStates.Visible;
                }
                else
                {
                    tvMode.Visibility = ViewStates.Gone;
                }

                return view;
            }
        }

        private class LogAdapter : BaseAdapter<ActivityLogEntry>
        {
            private readonly Activity                _ctx;
            private readonly List<ActivityLogEntry> _items;

            public LogAdapter(Activity ctx, List<ActivityLogEntry> items)
            { _ctx = ctx; _items = items; }

            public override int Count => _items.Count;
            public override ActivityLogEntry this[int position] => _items[position];
            public override long GetItemId(int position) => position;

            public override View GetView(int position, View? convertView, ViewGroup parent)
            {
                var view = convertView
                    ?? LayoutInflater.From(_ctx)!.Inflate(Resource.Layout.item_log, parent, false)!;

                var e = _items[position];

                view.FindViewById<TextView>(Resource.Id.tvLogAction)!.Text =
                    $"{e.UserName} {GetActionLabel(e.Action)}";
                view.FindViewById<TextView>(Resource.Id.tvLogTable)!.Text =
                    $"Стол №{e.TableNumber} · {FormatDateTimeRange(e.BookingStartTime, e.BookingEndTime)}";
                view.FindViewById<TextView>(Resource.Id.tvLogTime)!.Text =
                    FormatDateTime(e.Timestamp);

                return view;
            }
        }
        private class DebugLogAdapter : BaseAdapter<RequestLogEntry>
        {
            private readonly Activity _ctx;
            private readonly List<RequestLogEntry> _items;

            public DebugLogAdapter(Activity ctx, List<RequestLogEntry> items)
            { _ctx = ctx; _items = items; }

            public override int Count => _items.Count;
            public override RequestLogEntry this[int position] => _items[position];
            public override long GetItemId(int position) => position;

            public override View GetView(int position, View? convertView, ViewGroup parent)
            {
                var view = convertView
                    ?? LayoutInflater.From(_ctx)!.Inflate(Resource.Layout.item_debug_log, parent, false)!;

                var e = _items[position];

                var tvStatus   = view.FindViewById<TextView>(Resource.Id.tvDbgStatus)!;
                var tvMethod   = view.FindViewById<TextView>(Resource.Id.tvDbgMethod)!;
                var tvUrl      = view.FindViewById<TextView>(Resource.Id.tvDbgUrl)!;
                var tvDuration = view.FindViewById<TextView>(Resource.Id.tvDbgDuration)!;
                var tvTime     = view.FindViewById<TextView>(Resource.Id.tvDbgTime)!;
                var tvBody     = view.FindViewById<TextView>(Resource.Id.tvDbgBody)!;

                if (e.Error != null)
                {
                    tvStatus.Text = "ERR";
                    tvStatus.SetTextColor(Color.ParseColor("#e94560"));
                    tvBody.Text = e.Error;
                    tvBody.SetTextColor(Color.ParseColor("#e94560"));
                    tvBody.Visibility = ViewStates.Visible;
                }
                else if (e.StatusCode.HasValue)
                {
                    tvStatus.Text = e.StatusCode.Value.ToString();
                    var statusColor = e.StatusCode.Value switch
                    {
                        >= 200 and < 300 => "#4caf50",
                        >= 400 and < 500 => "#ffc107",
                        _                => "#e94560"
                    };
                    tvStatus.SetTextColor(Color.ParseColor(statusColor));

                    if (!string.IsNullOrEmpty(e.ResponseBody))
                    {
                        tvBody.Text = e.ResponseBody;
                        tvBody.SetTextColor(Color.ParseColor("#999999"));
                        tvBody.Visibility = ViewStates.Visible;
                    }
                    else
                    {
                        tvBody.Visibility = ViewStates.Gone;
                    }
                }
                else
                {
                    tvStatus.Text = "---";
                    tvStatus.SetTextColor(Color.ParseColor("#888888"));
                    tvBody.Visibility = ViewStates.Gone;
                }

                tvMethod.Text   = e.Method;
                tvUrl.Text      = e.Url.Replace(ApiService.BaseUrl, "");
                tvDuration.Text = $"{e.DurationMs}ms";
                tvTime.Text     = e.Timestamp.ToString("HH:mm:ss.fff") + " UTC";

                return view;
            }
        }
    }
}
