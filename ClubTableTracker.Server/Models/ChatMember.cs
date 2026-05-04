namespace ClubTableTracker.Server.Models;

public class ChatMember
{
    public int Id { get; set; }
    public int ChatId { get; set; }
    public Chat Chat { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;
    public DateTime? LastReadAt { get; set; }
}
