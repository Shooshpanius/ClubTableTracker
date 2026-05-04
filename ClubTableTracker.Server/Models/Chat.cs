using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
namespace ClubTableTracker.Server.Models;

public class Chat
{
    public int Id { get; set; }
    [MaxLength(100)] public string? Name { get; set; }
    public bool IsGroup { get; set; } = false;
    public int? ClubId { get; set; }
    public Club? Club { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ChatMember> Members { get; set; } = new();
    public List<ChatMessage> Messages { get; set; } = new();
}
