using System;
using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class ClubMembership
{
    public int Id { get; set; }
    public string? UserId { get; set; }
    public AppUser? User { get; set; }
    public int ClubId { get; set; }
    public Club Club { get; set; } = null!;
    public string Status { get; set; } = "Pending"; // Pending/Approved/Rejected
    public bool IsModerator { get; set; } = false;
    public bool HasKey { get; set; } = false;
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public bool IsManualEntry { get; set; } = false;
    [MaxLength(100)]  public string? ManualName               { get; set; }
    [MaxLength(200)]  public string? ManualEmail              { get; set; }
    [MaxLength(500)]  public string? ManualEnabledGameSystems { get; set; }
    [MaxLength(50)]   public string? ManualCity               { get; set; }
}
