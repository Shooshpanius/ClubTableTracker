using System.Collections.Generic;
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
        private static readonly HttpClient _client = new HttpClient();
        private const string BaseUrl = "https://club.wh40kcards.ru/api";
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

        public async Task<List<Club>?> GetClubsAsync()
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/club"));
                if (!res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<Club>>(await res.Content.ReadAsStringAsync(), JsonOpts);
            }
            catch { return null; }
        }

        public async Task<List<Membership>?> GetMembershipsAsync()
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/club/my-memberships"));
                if (!res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<Membership>>(await res.Content.ReadAsStringAsync(), JsonOpts);
            }
            catch { return null; }
        }

        public async Task<bool> ApplyForMembershipAsync(int clubId)
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Post, $"{BaseUrl}/club/{clubId}/apply"));
                return res.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        public async Task<List<UpcomingBooking>?> GetMyUpcomingBookingsAsync()
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/booking/my-upcoming"));
                if (!res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<UpcomingBooking>>(await res.Content.ReadAsStringAsync(), JsonOpts);
            }
            catch { return null; }
        }

        public async Task<List<ActivityLogEntry>?> GetActivityLogAsync()
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/booking/activity-log"));
                if (!res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<List<ActivityLogEntry>>(await res.Content.ReadAsStringAsync(), JsonOpts);
            }
            catch { return null; }
        }

        public async Task<UserProfile?> GetUserMeAsync()
        {
            try
            {
                var res = await _client.SendAsync(Req(HttpMethod.Get, $"{BaseUrl}/user/me"));
                if (!res.IsSuccessStatusCode) return null;
                return JsonSerializer.Deserialize<UserProfile>(await res.Content.ReadAsStringAsync(), JsonOpts);
            }
            catch { return null; }
        }

        public async Task<bool> UpdateDisplayNameAsync(string? name)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/display-name");
                r.Content = Json(new { displayName = name });
                return (await _client.SendAsync(r)).IsSuccessStatusCode;
            }
            catch { return false; }
        }

        public async Task<bool> UpdateBioAsync(string? bio)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/bio");
                r.Content = Json(new { bio });
                return (await _client.SendAsync(r)).IsSuccessStatusCode;
            }
            catch { return false; }
        }

        public async Task<bool> UpdateGameSystemsAsync(List<string> systems)
        {
            try
            {
                var r = Req(HttpMethod.Put, $"{BaseUrl}/user/game-systems");
                r.Content = Json(new { enabledGameSystems = systems });
                return (await _client.SendAsync(r)).IsSuccessStatusCode;
            }
            catch { return false; }
        }
    }
}
