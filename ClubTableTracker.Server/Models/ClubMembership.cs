using System;
namespace ClubTableTracker.Server.Models;

public class ClubMembership
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    public string Status { get; set; } = "Pending"; // Pending/Approved/Rejected
    public bool IsModerator { get; set; } = false;
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
}
