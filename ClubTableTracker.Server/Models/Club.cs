using System.Collections.Generic;
namespace ClubTableTracker.Server.Models;

public class Club
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string OpenTime { get; set; } = "10:00";
    public string CloseTime { get; set; } = "22:00";
    public string? LogoUrl { get; set; }
    public List<GameTable> Tables { get; set; } = new();
    public List<ClubMembership> Memberships { get; set; } = new();
}
