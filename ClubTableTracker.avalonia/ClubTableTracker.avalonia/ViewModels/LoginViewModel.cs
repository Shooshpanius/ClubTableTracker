using System;
using System.Diagnostics;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ClubTableTracker.avalonia.Models;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class LoginViewModel : ViewModelBase
{
    private readonly TokenService _tokenService;
    private readonly ApiService _apiService;

    public event System.Action? LoginSucceeded;

    [ObservableProperty]
    private string _tokenInput = "";

    [ObservableProperty]
    private string _errorMessage = "";

    [ObservableProperty]
    private bool _isLoading;

    public LoginViewModel(TokenService tokenService, ApiService apiService)
    {
        _tokenService = tokenService;
        _apiService = apiService;
    }

    [RelayCommand]
    private void OpenWebApp()
    {
        try
        {
            Process.Start(new ProcessStartInfo("https://club.wh40kcards.ru")
            {
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Не удалось открыть браузер: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        var token = TokenInput.Trim();
        if (string.IsNullOrEmpty(token))
        {
            ErrorMessage = "Введите токен";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";

        _tokenService.SaveToken(token);

        UserDto? user;
        bool serverUnavailable;
        try
        {
            user = await _apiService.GetMeAsync();
            serverUnavailable = false;
        }
        catch (Exception)
        {
            user = null;
            serverUnavailable = true;
        }

        IsLoading = false;

        if (user != null)
        {
            LoginSucceeded?.Invoke();
        }
        else
        {
            _tokenService.ClearToken();
            ErrorMessage = serverUnavailable
                ? "Сервер недоступен. Проверьте подключение к интернету."
                : "Неверный токен. Убедитесь, что скопировали токен правильно.";
        }
    }
}
