using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class AppUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    [MaxLength(100)] public string? DisplayName { get; set; }
    [MaxLength(100)] public string? City { get; set; }
    public string? EnabledGameSystems { get; set; }
    [MaxLength(500)] public string? BookingColors { get; set; }
    public string? Bio { get; set; }
    public string GoogleId { get; set; } = string.Empty;
    public List<ClubMembership> Memberships { get; set; } = new();
    public List<Booking> Bookings { get; set; } = new();
}
