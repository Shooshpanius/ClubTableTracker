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
    public string? VkUrl { get; set; }
    public string? TelegramUrl { get; set; }
    public string? InstagramUrl { get; set; }
    public string? WhatsAppUrl { get; set; }
    public string? YouTubeUrl { get; set; }
    public string? DiscordUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public List<GameTable> Tables { get; set; } = new();
    public List<ClubMembership> Memberships { get; set; } = new();
}
