using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ClubTableTracker.avalonia.Models;
using ClubTableTracker.avalonia.Services;

namespace ClubTableTracker.avalonia.ViewModels;

public partial class ClubListViewModel : ViewModelBase
{
    private readonly ApiService _apiService;

    [ObservableProperty]
    private ObservableCollection<ClubMembershipItem> _myClubs = new();

    [ObservableProperty]
    private ObservableCollection<ClubMembershipItem> _availableClubs = new();

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _statusMessage = "";

    public ClubListViewModel(ApiService apiService)
    {
        _apiService = apiService;
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        StatusMessage = "";

        var allClubs = await _apiService.GetClubsAsync();
        var memberships = await _apiService.GetMyMembershipsAsync();

        MyClubs.Clear();
        AvailableClubs.Clear();

        var membershipMap = memberships.ToDictionary(m => m.Club.Id, m => m.Status);

        foreach (var club in allClubs)
        {
            if (membershipMap.TryGetValue(club.Id, out var status))
                MyClubs.Add(new ClubMembershipItem(club, status, ApplyForMembershipAsync));
            else
                AvailableClubs.Add(new ClubMembershipItem(club, null, ApplyForMembershipAsync));
        }

        IsLoading = false;

        if (MyClubs.Count == 0 && AvailableClubs.Count == 0)
            StatusMessage = "Нет доступных клубов";
    }

    private async Task ApplyForMembershipAsync(ClubMembershipItem item)
    {
        item.IsApplying = true;
        var success = await _apiService.ApplyForMembershipAsync(item.Club.Id);
        if (success)
            item.MembershipStatus = "Pending";
        item.IsApplying = false;
    }
}

public partial class ClubMembershipItem : ObservableObject
{
    private readonly Func<ClubMembershipItem, Task> _onApply;

    public ClubDto Club { get; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanApply))]
    [NotifyPropertyChangedFor(nameof(StatusLabel))]
    private string? _membershipStatus;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CanApply))]
    private bool _isApplying;

    public bool CanApply => MembershipStatus == null && !IsApplying;

    public string StatusLabel => MembershipStatus switch
    {
        "Approved" => "✅ Участник",
        "Pending" => "⏳ Ожидание подтверждения",
        "Kicked" => "❌ Исключён",
        "Rejected" => "❌ Отклонено",
        _ => ""
    };

    public ClubMembershipItem(ClubDto club, string? membershipStatus, Func<ClubMembershipItem, Task> onApply)
    {
        Club = club;
        _membershipStatus = membershipStatus;
        _onApply = onApply;
    }

    [RelayCommand]
    private Task ApplyAsync() => _onApply(this);
}
