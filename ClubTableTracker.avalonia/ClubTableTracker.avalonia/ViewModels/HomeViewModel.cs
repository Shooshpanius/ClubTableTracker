using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class HomeViewModel : ViewModelBase
{
    public ClubListViewModel ClubsTab { get; }
    public BookingsViewModel BookingsTab { get; }
    public ProfileViewModel ProfileTab { get; }

    public event System.Action? LoggedOut;

    [ObservableProperty]
    private ViewModelBase _currentTab;

    [ObservableProperty]
    private int _selectedTabIndex;

    [ObservableProperty]
    private bool _isClubsTabActive = true;

    [ObservableProperty]
    private bool _isBookingsTabActive;

    [ObservableProperty]
    private bool _isProfileTabActive;

    public HomeViewModel(ApiService apiService, TokenService tokenService)
    {
        ClubsTab = new ClubListViewModel(apiService);
        BookingsTab = new BookingsViewModel(apiService);
        ProfileTab = new ProfileViewModel(apiService, tokenService);
        ProfileTab.LoggedOut += () => LoggedOut?.Invoke();
        _currentTab = ClubsTab;
    }

    public async Task InitializeAsync()
    {
        await ClubsTab.LoadAsync();
    }

    [RelayCommand]
    private async Task SelectClubsTabAsync()
    {
        SelectedTabIndex = 0;
        IsClubsTabActive = true;
        IsBookingsTabActive = false;
        IsProfileTabActive = false;
        CurrentTab = ClubsTab;
        await ClubsTab.LoadAsync();
    }

    [RelayCommand]
    private async Task SelectBookingsTabAsync()
    {
        SelectedTabIndex = 1;
        IsClubsTabActive = false;
        IsBookingsTabActive = true;
        IsProfileTabActive = false;
        CurrentTab = BookingsTab;
        await BookingsTab.LoadAsync();
    }

    [RelayCommand]
    private async Task SelectProfileTabAsync()
    {
        SelectedTabIndex = 2;
        IsClubsTabActive = false;
        IsBookingsTabActive = false;
        IsProfileTabActive = true;
        CurrentTab = ProfileTab;
        await ProfileTab.LoadAsync();
    }
}
