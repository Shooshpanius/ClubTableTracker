using System;
namespace ClubTableTracker.Server.Models;

public class BookingLog
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    // "Booked" | "Joined" | "Left" | "Cancelled"
    public string Action { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    // Snapshot fields (preserved even after booking is deleted)
    public int? BookingId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int ClubId { get; set; }
    public DateTime BookingStartTime { get; set; }
    public DateTime BookingEndTime { get; set; }
}
