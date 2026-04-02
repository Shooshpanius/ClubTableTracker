using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using ClubTableTracker.avalonia.Models;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class MainViewModel : ViewModelBase
{
    private readonly TokenService _tokenService;
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ViewModelBase _currentPage = null!;

    public MainViewModel()
    {
        _tokenService = new TokenService();
        _apiService = new ApiService(_tokenService);
        Initialize();
    }

    private async void Initialize()
    {
        try
        {
            if (_tokenService.HasToken())
            {
                // Validate the stored token against the server before showing home.
                // If it's expired or the server is unreachable, fall back to the login screen.
                UserDto? user;
                try { user = await _apiService.GetMeAsync(); }
                catch (Exception) { user = null; }

                if (user != null)
                    await ShowHomeAsync();
                else
                {
                    _tokenService.ClearToken();
                    ShowLogin();
                }
            }
            else
                ShowLogin();
        }
        catch
        {
            ShowLogin();
        }
    }

    private void ShowLogin()
    {
        var login = new LoginViewModel(_tokenService, _apiService);
        login.LoginSucceeded += async () => await ShowHomeAsync();
        CurrentPage = login;
    }

    private async Task ShowHomeAsync()
    {
        var home = new HomeViewModel(_apiService, _tokenService);
        home.LoggedOut += ShowLogin;
        CurrentPage = home;
        await home.InitializeAsync();
    }
}
