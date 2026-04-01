using CommunityToolkit.Mvvm.ComponentModel;

namespace ClubTableTracker.avalonia.ViewModels
{
    public partial class MainViewModel : ViewModelBase
    {
        [ObservableProperty]
        private string _greeting = "Welcome to Avalonia!";
    }
}
