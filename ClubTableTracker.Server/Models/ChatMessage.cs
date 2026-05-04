using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class ChatMessage
{
    public int Id { get; set; }
    public int ChatId { get; set; }
    public Chat Chat { get; set; } = null!;
    public string SenderId { get; set; } = string.Empty;
    public AppUser Sender { get; set; } = null!;
    [MaxLength(4000)] public string Text { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
