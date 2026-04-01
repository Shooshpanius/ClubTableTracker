using System.Collections.Generic;
namespace ClubTableTracker.Server.Models;

public class AppUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? EnabledGameSystems { get; set; }
    public string? BookingColors { get; set; }
    public string GoogleId { get; set; } = string.Empty;
    public List<ClubMembership> Memberships { get; set; } = new();
    public List<Booking> Bookings { get; set; } = new();
}
