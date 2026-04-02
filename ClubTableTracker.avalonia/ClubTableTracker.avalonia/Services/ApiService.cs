using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ClubTableTracker.avalonia.Models;

namespace ClubTableTracker.avalonia.Services;

public class ApiService
{
    private readonly HttpClient _http;
    private readonly TokenService _tokenService;

    public ApiService(TokenService tokenService)
    {
        _tokenService = tokenService;
        // HttpClient is created once per ApiService instance.
        // ApiService itself is a singleton (created in MainViewModel and shared across ViewModels),
        // so the underlying socket connections are properly reused throughout the app's lifetime.
        _http = new HttpClient
        {
            BaseAddress = new Uri(ApiConfig.BaseUrl + "/"),
            Timeout = TimeSpan.FromSeconds(15)
        };
    }

    private void ApplyAuthHeader()
    {
        var token = _tokenService.GetToken();
        _http.DefaultRequestHeaders.Authorization = string.IsNullOrEmpty(token)
            ? null
            : new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>
    /// Returns the current user, or null if the token is invalid/expired (401).
    /// Throws <see cref="HttpRequestException"/> if the server is unreachable or returns an unexpected error.
    /// </summary>
    public async Task<UserDto?> GetMeAsync()
    {
        ApplyAuthHeader();
        try
        {
            return await _http.GetFromJsonAsync<UserDto>("user/me");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return null;
        }
    }

    public async Task<List<ClubDto>> GetClubsAsync()
    {
        ApplyAuthHeader();
        try { return await _http.GetFromJsonAsync<List<ClubDto>>("club") ?? new(); }
        catch { return new(); }
    }

    public async Task<List<MembershipDto>> GetMyMembershipsAsync()
    {
        ApplyAuthHeader();
        try { return await _http.GetFromJsonAsync<List<MembershipDto>>("club/my-memberships") ?? new(); }
        catch { return new(); }
    }

    public async Task<bool> ApplyForMembershipAsync(int clubId)
    {
        ApplyAuthHeader();
        try
        {
            var response = await _http.PostAsync($"club/{clubId}/apply", null);
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public async Task<List<BookingDto>> GetMyUpcomingBookingsAsync()
    {
        ApplyAuthHeader();
        try { return await _http.GetFromJsonAsync<List<BookingDto>>("booking/my-upcoming") ?? new(); }
        catch { return new(); }
    }

    public async Task<bool> UpdateDisplayNameAsync(string? displayName)
    {
        ApplyAuthHeader();
        try
        {
            var response = await _http.PutAsJsonAsync("user/display-name", new { DisplayName = displayName });
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public async Task<bool> UpdateBioAsync(string? bio)
    {
        ApplyAuthHeader();
        try
        {
            var response = await _http.PutAsJsonAsync("user/bio", new { Bio = bio });
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }
}
