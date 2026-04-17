using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class Booking
{
    public int Id { get; set; }
    public int TableId { get; set; }
    public GameTable Table { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    [MaxLength(100)] public string? GameSystem { get; set; }
    public bool IsDoubles { get; set; }
    public bool IsForOthers { get; set; }
    [MaxLength(6000)] public string? OwnerRoster { get; set; }
    public List<BookingParticipant> Participants { get; set; } = new();
}
