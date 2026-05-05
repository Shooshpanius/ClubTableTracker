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

        // Идентификаторы клубов, в которых состоит пользователь
        var myClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved" && !m.IsManualEntry)
            .Select(m => m.ClubId)
            .ToList();

        // Чаты, в которых пользователь явный участник (личные, приватные и уже присоединённые публичные)
        var memberChats = _db.Chats
            .Include(c => c.Members).ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(msg => msg.SentAt).Take(1))
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .ToList();

        // Публичные групповые чаты клубов пользователя, в которых он ещё не участник
        var joinedChatIds = memberChats.Select(c => c.Id).ToHashSet();
        var publicGroupChats = _db.Chats
            .Include(c => c.Members).ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(msg => msg.SentAt).Take(1))
            .Where(c => c.IsGroup && c.IsPublic && c.ClubId != null && myClubIds.Contains(c.ClubId!.Value) && !joinedChatIds.Contains(c.Id))
            .ToList();

        var chats = memberChats.Concat(publicGroupChats)
            .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.SentAt) ?? c.CreatedAt)
            .ToList();

        var chatIds = chats.Select(c => c.Id).ToList();
        var lastReadByChat = chats
            .Select(c => new { c.Id, LastReadAt = c.Members.FirstOrDefault(m => m.UserId == userId)?.LastReadAt })
            .ToDictionary(x => x.Id, x => x.LastReadAt);

        // Загружаем chatId + sentAt в память, затем группируем
        var rawUnread = _db.ChatMessages
            .Where(m => chatIds.Contains(m.ChatId) && m.SenderId != userId)
            .Select(m => new { m.ChatId, m.SentAt })
            .ToList();

        var unreadCounts = rawUnread
            .GroupBy(m => m.ChatId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    lastReadByChat.TryGetValue(g.Key, out var lastReadAt);
                    // Если lastReadAt == null (пользователь ещё не открывал чат), все сообщения считаются непрочитанными
                    return g.Count(m => lastReadAt == null || m.SentAt > lastReadAt);
                });

        var result = chats.Select(c =>
        {
            var lastMsg = c.Messages.FirstOrDefault();
            string displayName;
            string? avatarUrl = null;
            if (c.IsGroup)
            {
                displayName = c.Name ?? "Групповой чат";
                avatarUrl = c.LogoUrl;
            }
            else
            {
                var other = c.Members.FirstOrDefault(m => m.UserId != userId);
                displayName = other?.User != null
                    ? (other.User.DisplayName ?? other.User.Name)
                    : "Пользователь";
                avatarUrl = other?.User?.AvatarUrl;
            }
            return new
            {
                c.Id,
                c.IsGroup,
                c.IsPublic,
                c.ClubId,
                Name = displayName,
                AvatarUrl = avatarUrl,
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

        var chat = _db.Chats.Find(chatId);
        if (chat == null) return NotFound();

        var member = _db.ChatMembers.FirstOrDefault(m => m.ChatId == chatId && m.UserId == userId);
        if (member == null)
        {
            // Публичный групповой чат: автоматически добавляем пользователя как участника
            if (chat.IsGroup && chat.IsPublic && chat.ClubId != null)
            {
                var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == chat.ClubId && m.Status == "Approved" && !m.IsManualEntry);
                if (!isMember) return Forbid();
                member = new ChatMember { ChatId = chatId, UserId = userId, LastReadAt = DateTime.UtcNow };
                _db.ChatMembers.Add(member);
                _db.SaveChanges();
                return NoContent();
            }
            return Forbid();
        }

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

        // Оба пользователя должны состоять хотя бы в одном общем клубе
        var myClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved" && !m.IsManualEntry)
            .Select(m => m.ClubId)
            .ToList();

        var sharesClub = myClubIds.Count > 0 && _db.Memberships
            .Any(m => m.UserId == req.OtherUserId && m.Status == "Approved" && !m.IsManualEntry && myClubIds.Contains(m.ClubId));

        if (!sharesClub) return Forbid();

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

        if (skip < 0) return BadRequest("skip не может быть отрицательным");
        if (take <= 0 || take > 100) return BadRequest("take должен быть от 1 до 100");

        var chat = _db.Chats.Find(chatId);
        if (chat == null) return NotFound();

        var isMember = _db.ChatMembers.Any(m => m.ChatId == chatId && m.UserId == userId);

        if (!isMember)
        {
            // Публичный групповой чат: разрешить доступ членам клуба и автоматически добавить в участники
            if (chat.IsGroup && chat.IsPublic && chat.ClubId != null)
            {
                var isClubMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == chat.ClubId && m.Status == "Approved" && !m.IsManualEntry);
                if (!isClubMember) return Forbid();
                _db.ChatMembers.Add(new ChatMember { ChatId = chatId, UserId = userId, LastReadAt = DateTime.UtcNow });
                _db.SaveChanges();
            }
            else
            {
                return Forbid();
            }
        }

        var messages = _db.ChatMessages
            .Include(m => m.Sender)
            .Include(m => m.ReplyTo).ThenInclude(r => r!.Sender)
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
                Sender = new { m.Sender.Id, Name = m.Sender.DisplayName ?? m.Sender.Name, AvatarUrl = m.Sender.AvatarUrl },
                ReplyTo = m.ReplyTo == null ? null : new
                {
                    m.ReplyTo.Id,
                    m.ReplyTo.Text,
                    SenderName = m.ReplyTo.Sender.DisplayName ?? m.ReplyTo.Sender.Name
                }
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

        var chat = _db.Chats.Find(chatId);
        if (chat == null) return NotFound();

        var isMember = _db.ChatMembers.Any(m => m.ChatId == chatId && m.UserId == userId);

        if (!isMember)
        {
            // Публичный групповой чат: разрешить отправку членам клуба и автоматически добавить в участники
            if (chat.IsGroup && chat.IsPublic && chat.ClubId != null)
            {
                var isClubMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == chat.ClubId && m.Status == "Approved" && !m.IsManualEntry);
                if (!isClubMember) return Forbid();
                _db.ChatMembers.Add(new ChatMember { ChatId = chatId, UserId = userId });
                _db.SaveChanges();
            }
            else
            {
                return Forbid();
            }
        }

        var message = new ChatMessage
        {
            ChatId = chatId,
            SenderId = userId,
            Text = req.Text.Trim(),
            SentAt = DateTime.UtcNow,
            ReplyToId = req.ReplyToId
        };
        _db.ChatMessages.Add(message);
        _db.SaveChanges();

        var sender = _db.Users.Find(userId)!;
        ChatMessage? replyMsg = req.ReplyToId.HasValue
            ? _db.ChatMessages.Include(m => m.Sender).FirstOrDefault(m => m.Id == req.ReplyToId.Value)
            : null;
        return Ok(new
        {
            message.Id,
            message.ChatId,
            message.Text,
            message.SentAt,
            Sender = new { sender.Id, Name = sender.DisplayName ?? sender.Name, AvatarUrl = sender.AvatarUrl },
            ReplyTo = replyMsg == null ? null : new
            {
                replyMsg.Id,
                replyMsg.Text,
                SenderName = replyMsg.Sender.DisplayName ?? replyMsg.Sender.Name
            }
        });
    }
    // DELETE /api/messenger/chats/{chatId}/messages/{messageId}
    [HttpDelete("chats/{chatId}/messages/{messageId}")]
    public IActionResult DeleteMessage(int chatId, int messageId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var message = _db.ChatMessages.FirstOrDefault(m => m.Id == messageId && m.ChatId == chatId);
        if (message == null) return NotFound();
        if (message.SenderId != userId) return Forbid();

        _db.ChatMessages.Remove(message);
        _db.SaveChanges();
        return NoContent();
    }
}

public record DirectChatRequest(string OtherUserId);
public record SendMessageRequest(string Text, int? ReplyToId = null);
