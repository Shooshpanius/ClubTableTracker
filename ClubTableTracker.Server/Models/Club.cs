using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class Club
{
    public int Id { get; set; }
    [MaxLength(100)]  public string Name        { get; set; } = string.Empty;
    [MaxLength(1000)] public string Description { get; set; } = string.Empty;
    [MaxLength(64)]   public string AccessKey   { get; set; } = string.Empty;
    public string OpenTime { get; set; } = "10:00";
    public string CloseTime { get; set; } = "22:00";
    public string? LogoUrl { get; set; }
    public List<GameTable> Tables { get; set; } = new();
    public List<ClubMembership> Memberships { get; set; } = new();
}
