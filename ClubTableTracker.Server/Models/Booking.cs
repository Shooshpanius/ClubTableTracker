using System;
using System.Collections.Generic;
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
    public List<BookingParticipant> Participants { get; set; } = new();
}
