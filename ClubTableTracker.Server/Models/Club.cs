using System.Collections.Generic;
namespace ClubTableTracker.Server.Models;

public class Club
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public List<GameTable> Tables { get; set; } = new();
    public List<ClubMembership> Memberships { get; set; } = new();
}
