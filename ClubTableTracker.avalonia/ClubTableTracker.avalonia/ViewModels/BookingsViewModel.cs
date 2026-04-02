using System.Collections.ObjectModel;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ClubTableTracker.avalonia.Models;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class BookingsViewModel : ViewModelBase
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<BookingDto> _bookings = new();

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _emptyMessage = "";

    public BookingsViewModel(ApiService apiService)
    {
        _apiService = apiService;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        Bookings.Clear();
        EmptyMessage = "";

        var bookings = await _apiService.GetMyUpcomingBookingsAsync();
        foreach (var b in bookings)
            Bookings.Add(b);

        IsLoading = false;

        if (Bookings.Count == 0)
            EmptyMessage = "У вас нет предстоящих бронирований";
    }
}
