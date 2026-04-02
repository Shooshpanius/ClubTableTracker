using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ClubTableTracker.avalonia.Models;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class ProfileViewModel : ViewModelBase
{
    private readonly ApiService _apiService;
    private readonly TokenService _tokenService;

    public event System.Action? LoggedOut;

    [ObservableProperty]
    private UserDto? _user;

    [ObservableProperty]
    private string _displayNameInput = "";

    [ObservableProperty]
    private string _bioInput = "";

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _saveStatus = "";

    public ProfileViewModel(ApiService apiService, TokenService tokenService)
    {
        _apiService = apiService;
        _tokenService = tokenService;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        SaveStatus = "";
        User = await _apiService.GetMeAsync();
        if (User != null)
        {
            DisplayNameInput = User.DisplayName ?? "";
            BioInput = User.Bio ?? "";
        }
        IsLoading = false;
    }

    [RelayCommand]
    private async Task SaveDisplayNameAsync()
    {
        SaveStatus = "";
        var value = string.IsNullOrWhiteSpace(DisplayNameInput) ? null : DisplayNameInput.Trim();
        var success = await _apiService.UpdateDisplayNameAsync(value);
        SaveStatus = success ? "✅ Имя сохранено" : "❌ Ошибка при сохранении";
    }

    [RelayCommand]
    private async Task SaveBioAsync()
    {
        SaveStatus = "";
        var value = string.IsNullOrWhiteSpace(BioInput) ? null : BioInput.Trim();
        var success = await _apiService.UpdateBioAsync(value);
        SaveStatus = success ? "✅ Описание сохранено" : "❌ Ошибка при сохранении";
    }

    [RelayCommand]
    private void Logout()
    {
        _tokenService.ClearToken();
        LoggedOut?.Invoke();
    }
}
