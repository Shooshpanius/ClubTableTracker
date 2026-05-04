using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessengerController : ControllerBase
{
    private readonly AppDbContext _db;
    public MessengerController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/messenger/chats — список всех чатов текущего пользователя
    [HttpGet("chats")]
    public IActionResult GetChats()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var chats = _db.Chats
            .Include(c => c.Members).ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(msg => msg.SentAt).Take(1))
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.SentAt) ?? c.CreatedAt)
            .ToList();

        // Получаем счётчики непрочитанных одним запросом для всех чатов
        var chatIds = chats.Select(c => c.Id).ToList();
        var lastReadByChat = chats
            .Select(c => new { c.Id, LastReadAt = c.Members.FirstOrDefault(m => m.UserId == userId)?.LastReadAt })
            .ToDictionary(x => x.Id, x => x.LastReadAt);

        var unreadCounts = _db.ChatMessages
            .Where(m => chatIds.Contains(m.ChatId) && m.SenderId != userId)
            .GroupBy(m => m.ChatId)
            .Select(g => new { ChatId = g.Key, Messages = g.Select(m => new { m.SentAt }).ToList() })
            .ToList()
            .ToDictionary(
                g => g.ChatId,
                g => g.Messages.Count(m => lastReadByChat.TryGetValue(g.ChatId, out var lr) && (lr == null || m.SentAt > lr)));

        var result = chats.Select(c =>
        {
            var lastMsg = c.Messages.FirstOrDefault();
            string displayName;
            if (c.IsGroup)
            {
                displayName = c.Name ?? "Групповой чат";
            }
            else
            {
                var other = c.Members.FirstOrDefault(m => m.UserId != userId);
                displayName = other?.User != null
                    ? (other.User.DisplayName ?? other.User.Name)
                    : "Пользователь";
            }
            return new
            {
                c.Id,
                c.IsGroup,
                c.ClubId,
                Name = displayName,
                LastMessage = lastMsg == null ? null : new { lastMsg.Text, lastMsg.SentAt },
                UnreadCount = unreadCounts.GetValueOrDefault(c.Id, 0)
            };
        });

        return Ok(result);
    }

    // POST /api/messenger/chats/{chatId}/read — пометить чат как прочитанный
    [HttpPost("chats/{chatId}/read")]
    public IActionResult MarkAsRead(int chatId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var member = _db.ChatMembers.FirstOrDefault(m => m.ChatId == chatId && m.UserId == userId);
        if (member == null) return Forbid();

        member.LastReadAt = DateTime.UtcNow;
        _db.SaveChanges();
        return NoContent();
    }

    // POST /api/messenger/chats/direct — начать или получить личный чат с другим пользователем
    [HttpPost("chats/direct")]
    public IActionResult GetOrCreateDirect([FromBody] DirectChatRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        if (userId == req.OtherUserId) return BadRequest("Нельзя создать чат с самим собой");

        var otherUser = _db.Users.Find(req.OtherUserId);
        if (otherUser == null) return NotFound("Пользователь не найден");

        var existing = _db.Chats
            .Include(c => c.Members)
            .Where(c => !c.IsGroup
                && c.Members.Any(m => m.UserId == userId)
                && c.Members.Any(m => m.UserId == req.OtherUserId))
            .FirstOrDefault();

        if (existing != null)
            return Ok(new { existing.Id, existing.IsGroup });

        var chat = new Chat { IsGroup = false };
        _db.Chats.Add(chat);
        _db.SaveChanges();
        _db.ChatMembers.AddRange(
            new ChatMember { ChatId = chat.Id, UserId = userId },
            new ChatMember { ChatId = chat.Id, UserId = req.OtherUserId }
        );
        _db.SaveChanges();
        return Ok(new { chat.Id, chat.IsGroup });
    }

    // GET /api/messenger/chats/{chatId}/messages
    [HttpGet("chats/{chatId}/messages")]
    public IActionResult GetMessages(int chatId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var isMember = _db.ChatMembers.Any(m => m.ChatId == chatId && m.UserId == userId);
        if (!isMember) return Forbid();

        var messages = _db.ChatMessages
            .Include(m => m.Sender)
            .Where(m => m.ChatId == chatId)
            .OrderByDescending(m => m.SentAt)
            .Skip(skip)
            .Take(take)
            .ToList()
            .Select(m => new
            {
                m.Id,
                m.ChatId,
                m.Text,
                m.SentAt,
                Sender = new { m.Sender.Id, Name = m.Sender.DisplayName ?? m.Sender.Name }
            })
            .Reverse()
            .ToList();

        return Ok(messages);
    }

    // POST /api/messenger/chats/{chatId}/messages
    [HttpPost("chats/{chatId}/messages")]
    public IActionResult SendMessage(int chatId, [FromBody] SendMessageRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.Text) || req.Text.Length > 4000)
            return BadRequest("Текст сообщения обязателен и не должен превышать 4000 символов");

        var isMember = _db.ChatMembers.Any(m => m.ChatId == chatId && m.UserId == userId);
        if (!isMember) return Forbid();

        var message = new ChatMessage
        {
            ChatId = chatId,
            SenderId = userId,
            Text = req.Text.Trim(),
            SentAt = DateTime.UtcNow
        };
        _db.ChatMessages.Add(message);
        _db.SaveChanges();

        var sender = _db.Users.Find(userId)!;
        return Ok(new
        {
            message.Id,
            message.ChatId,
            message.Text,
            message.SentAt,
            Sender = new { sender.Id, Name = sender.DisplayName ?? sender.Name }
        });
    }
}

public record DirectChatRequest(string OtherUserId);
public record SendMessageRequest(string Text);
