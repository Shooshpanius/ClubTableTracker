using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using MobileAndroid.Models;

namespace MobileAndroid.Services
{
    public class ApiService
    {
        private static readonly HttpClient _client = new HttpClient(new Xamarin.Android.Net.AndroidMessageHandler());
        internal const string BaseUrl = "https://go40k.ru/api";
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly string _token;

        public ApiService(string token)
        {
            _token = token;
        }

        private HttpRequestMessage Req(HttpMethod method, string url)
        {
            var r = new HttpRequestMessage(method, url);
            if (!string.IsNullOrEmpty(_token))
                r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
            return r;
        }

        private StringContent Json(object body) =>
            new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        private async Task<(HttpResponseMessage? Response, string Body)> SendAsync(HttpRequestMessage req)
        {
            var entry = new RequestLogEntry
            {
                Timestamp = DateTime.UtcNow,
                Method    = req.Method.Method,
                Url       = req.RequestUri?.ToString() ?? ""
            };
            var sw = Stopwatch.StartNew();
            try
            {
                var res = await _client.SendAsync(req);
                sw.Stop();
                entry.DurationMs = sw.ElapsedMilliseconds;
                entry.StatusCode = (int)res.StatusCode;
                var body = await res.Content.ReadAsStringAsync();
                // Truncate log display only; full body is returned for deserialization
                entry.ResponseBody = body.Length > 300 ? body[..300] + "…" : body;
                RequestLogger.Add(entry);
                return (res, body);
            }
            catch (Exception ex)
            {
                sw.Stop();
                entry.DurationMs = sw.ElapsedMilliseconds;
                entry.Error      = ex.InnerException != null
                    ? $"{ex.Message} → {ex.InnerException.Message}"
                    : ex.Message;
                RequestLogger.Add(entry);
                return (null, "");
            }
        }

        public async Task<List<Club>?> GetClubsAsync()
        {
            try
            {
                var (res, body) = await SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/club"));
                if (res == null || !res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<Club>>(body, JsonOpts);
            }
            catch { return null; }
        }

        public async Task<List<Membership>?> GetMembershipsAsync()
        {
            try
            {
                var (res, body) = await SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/club/my-memberships"));
                if (res == null || !res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<Membership>>(body, JsonOpts);
            }
            catch { return null; }
        }

        public async Task<bool> ApplyForMembershipAsync(int clubId)
        {
            try
            {
                var (res, _) = await SendAsync(Req(HttpMethod.Post, $"{BaseUrl}/club/{clubId}/apply"));
                return res?.IsSuccessStatusCode == true;
            }
            catch { return false; }
        }

        public async Task<List<UpcomingBooking>?> GetMyUpcomingBookingsAsync()
        {
            try
            {
                var (res, body) = await SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/booking/my-upcoming"));
                if (res == null || !res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<UpcomingBooking>>(body, JsonOpts);
            }
            catch { return null; }
        }

        public async Task<List<ActivityLogEntry>?> GetActivityLogAsync()
        {
            try
            {
                var (res, body) = await SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/booking/activity-log"));
                if (res == null || !res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<ActivityLogEntry>>(body, JsonOpts);
            }
            catch { return null; }
        }

        public async Task<UserProfile?> GetUserMeAsync()
        {
            try
            {
                var (res, body) = await SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/user/me"));
                if (res == null || !res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<UserProfile>(body, JsonOpts);
            }
            catch { return null; }
        }

        public async Task<bool> UpdateDisplayNameAsync(string? name)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/display-name");
                r.Content = Json(new { displayName = name });
                var (res, _) = await SendAsync(r);
                return res?.IsSuccessStatusCode == true;
            }
            catch { return false; }
        }

        public async Task<bool> UpdateBioAsync(string? bio)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/bio");
                r.Content = Json(new { bio });
                var (res, _) = await SendAsync(r);
                return res?.IsSuccessStatusCode == true;
            }
            catch { return false; }
        }

        public async Task<bool> UpdateGameSystemsAsync(List<string> systems)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/game-systems");
                r.Content = Json(new { enabledGameSystems = systems });
                var (res, _) = await SendAsync(r);
                return res?.IsSuccessStatusCode == true;
            }
            catch { return false; }
        }
    }
}
