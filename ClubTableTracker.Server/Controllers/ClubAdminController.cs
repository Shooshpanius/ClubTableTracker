using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClubTableTracker.Server.Data;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClubAdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClubAdminController(AppDbContext db) => _db = db;

    private Club? GetAuthorizedClub()
    {
        if (!Request.Headers.TryGetValue("X-Club-Key", out var key)) return null;
        return _db.Clubs.FirstOrDefault(c => c.AccessKey == key.ToString());
    }

    [HttpGet("me")]
    public IActionResult GetMe()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        return Ok(new { club.Id, club.Name, club.Description, club.OpenTime, club.CloseTime });
    }

    [HttpPut("settings")]
    public IActionResult UpdateSettings([FromBody] ClubSettingsRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        club.OpenTime = req.OpenTime;
        club.CloseTime = req.CloseTime;
        _db.SaveChanges();
        return Ok(new { club.OpenTime, club.CloseTime });
    }

    [HttpGet("tables")]
    public IActionResult GetTables()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var tables = _db.GameTables
            .Where(t => t.ClubId == club.Id)
            .Select(t => new { t.Id, t.ClubId, t.Number, t.Size, t.SupportedGames, t.X, t.Y, t.Width, t.Height, t.EventsOnly })
            .ToList();
        return Ok(tables);
    }

    [HttpPost("tables")]
    public IActionResult CreateTable([FromBody] TableRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = new GameTable
        {
            ClubId = club.Id,
            Number = req.Number,
            Size = req.Size,
            SupportedGames = req.SupportedGames,
            X = req.X,
            Y = req.Y,
            Width = req.Width,
            Height = req.Height,
            EventsOnly = req.EventsOnly
        };
        _db.GameTables.Add(table);
        _db.SaveChanges();
        return Ok(new { table.Id, table.ClubId, table.Number, table.Size, table.SupportedGames, table.X, table.Y, table.Width, table.Height, table.EventsOnly });
    }

    [HttpPut("tables/{id}")]
    public IActionResult UpdateTable(int id, [FromBody] TableRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = _db.GameTables.FirstOrDefault(t => t.Id == id && t.ClubId == club.Id);
        if (table == null) return NotFound();
        table.Number = req.Number;
        table.Size = req.Size;
        table.SupportedGames = req.SupportedGames;
        table.X = req.X;
        table.Y = req.Y;
        table.Width = req.Width;
        table.Height = req.Height;
        table.EventsOnly = req.EventsOnly;
        _db.SaveChanges();
        return Ok(new { table.Id, table.ClubId, table.Number, table.Size, table.SupportedGames, table.X, table.Y, table.Width, table.Height, table.EventsOnly });
    }

    [HttpPost("tables/{id}/copy")]
    public IActionResult CopyTable(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var source = _db.GameTables.FirstOrDefault(t => t.Id == id && t.ClubId == club.Id);
        if (source == null) return NotFound();
        var copy = new GameTable
        {
            ClubId = club.Id,
            Number = source.Number + " (Copy)",
            Size = source.Size,
            SupportedGames = source.SupportedGames,
            X = source.X + 20,
            Y = source.Y + 20,
            Width = source.Width,
            Height = source.Height,
            EventsOnly = source.EventsOnly
        };
        _db.GameTables.Add(copy);
        _db.SaveChanges();
        return Ok(new { copy.Id, copy.ClubId, copy.Number, copy.Size, copy.SupportedGames, copy.X, copy.Y, copy.Width, copy.Height, copy.EventsOnly });
    }

    [HttpDelete("tables/{id}")]
    public IActionResult DeleteTable(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var table = _db.GameTables.FirstOrDefault(t => t.Id == id && t.ClubId == club.Id);
        if (table == null) return NotFound();
        _db.GameTables.Remove(table);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpGet("memberships")]
    public IActionResult GetMemberships()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var memberships = _db.Memberships
            .Include(m => m.User)
            .Where(m => m.ClubId == club.Id)
            .ToList()
            .Select(m => new
            {
                m.Id,
                m.Status,
                m.IsModerator,
                m.AppliedAt,
                m.IsManualEntry,
                User = new
                {
                    Id = m.UserId ?? "",
                    Name = m.IsManualEntry ? (m.ManualName ?? "") : (m.User?.DisplayName ?? m.User?.Name ?? ""),
                    Email = m.IsManualEntry ? (m.ManualEmail ?? "") : (m.User?.Email ?? ""),
                    EnabledGameSystems = m.IsManualEntry ? null : m.User?.EnabledGameSystems
                }
            });
        return Ok(memberships);
    }

    [HttpPost("memberships/manual")]
    public IActionResult AddManualMember([FromBody] ManualMemberRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Имя игрока не может быть пустым");
        var membership = new ClubMembership
        {
            ClubId = club.Id,
            Status = "Approved",
            IsManualEntry = true,
            ManualName = req.Name.Trim(),
            ManualEmail = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim()
        };
        _db.Memberships.Add(membership);
        _db.SaveChanges();
        return Ok(new
        {
            membership.Id,
            membership.Status,
            membership.IsModerator,
            membership.AppliedAt,
            membership.IsManualEntry,
            User = new { Id = "", Name = membership.ManualName, Email = membership.ManualEmail ?? "", EnabledGameSystems = (string?)null }
        });
    }

    [HttpPut("memberships/{id}/manual")]
    public IActionResult UpdateManualMember(int id, [FromBody] ManualMemberRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id && m.IsManualEntry);
        if (membership == null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Имя игрока не может быть пустым");
        membership.ManualName = req.Name.Trim();
        membership.ManualEmail = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        _db.SaveChanges();
        return Ok(new
        {
            membership.Id,
            membership.Status,
            membership.IsModerator,
            membership.AppliedAt,
            membership.IsManualEntry,
            User = new { Id = "", Name = membership.ManualName, Email = membership.ManualEmail ?? "", EnabledGameSystems = (string?)null }
        });
    }

    [HttpPost("memberships/{id}/set-moderator")]
    public IActionResult SetModerator(int id, [FromBody] SetModeratorRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id && m.Status == "Approved");
        if (membership == null) return NotFound();
        membership.IsModerator = req.IsModerator;
        _db.SaveChanges();
        return Ok(new { membership.Id, membership.IsModerator });
    }

    [HttpPost("memberships/{id}/approve")]
    public IActionResult ApproveMembership(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id);
        if (membership == null) return NotFound();
        membership.Status = "Approved";
        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("memberships/{id}/reject")]
    public IActionResult RejectMembership(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id);
        if (membership == null) return NotFound();
        membership.Status = "Rejected";
        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("memberships/{id}/kick")]
    public IActionResult KickMember(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.FirstOrDefault(m => m.Id == id && m.ClubId == club.Id);
        if (membership == null) return NotFound();

        var userId = membership.UserId;

        if (userId == null)
        {
            membership.Status = "Kicked";
            _db.SaveChanges();
            return Ok();
        }

        var now = DateTime.UtcNow;

        // Cancel future bookings where the user is the organizer
        var organizerBookings = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .Where(b => b.UserId == userId && b.Table.ClubId == club.Id && b.StartTime > now)
            .ToList();

        foreach (var booking in organizerBookings)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = now,
                Action = "Cancelled",
                UserId = userId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = club.Id,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });

            if (booking.Participants.Count > 0)
            {
                var firstParticipant = booking.Participants.OrderBy(p => p.Id).First();
                booking.UserId = firstParticipant.UserId;
                _db.BookingParticipants.Remove(firstParticipant);
            }
            else
            {
                _db.Bookings.Remove(booking);
            }
        }

        // Remove user from future bookings where they are a participant
        var participantEntries = _db.BookingParticipants
            .Include(p => p.Booking).ThenInclude(b => b.Table)
            .Where(p => p.UserId == userId && p.Booking.Table.ClubId == club.Id && p.Booking.StartTime > now)
            .ToList();

        foreach (var participant in participantEntries)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = now,
                Action = "Left",
                UserId = userId,
                BookingId = participant.BookingId,
                TableNumber = participant.Booking.Table.Number,
                ClubId = club.Id,
                BookingStartTime = participant.Booking.StartTime,
                BookingEndTime = participant.Booking.EndTime
            });
            _db.BookingParticipants.Remove(participant);
        }

        membership.Status = "Kicked";
        _db.SaveChanges();
        return Ok();
    }
    [HttpGet("events")]
    public IActionResult GetEvents()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var events = _db.ClubEvents
            .Include(e => e.Participants).ThenInclude(p => p.User)
            .Where(e => e.ClubId == club.Id)
            .OrderBy(e => e.StartTime)
            .Select(e => new
            {
                e.Id, e.Title, e.StartTime, e.EndTime, e.MaxParticipants, e.EventType, e.GameSystem, e.TableIds,
                Participants = e.Participants.Select(p => new { p.User.Id, Name = p.User.DisplayName ?? p.User.Name })
            })
            .ToList();
        return Ok(events);
    }

    [HttpPost("events")]
    public IActionResult CreateEvent([FromBody] ClubEventRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();

        // Validate whole hours only
        if (req.StartTime.Minute != 0 || req.StartTime.Second != 0)
            return BadRequest("Время начала события должно быть на ровный час");
        if (req.EndTime.Minute != 0 || req.EndTime.Second != 0)
            return BadRequest("Время окончания события должно быть на ровный час");

        if (req.EndTime <= req.StartTime)
            return BadRequest("Время окончания должно быть позже времени начала");

        if ((req.EndTime - req.StartTime).TotalDays > 3)
            return BadRequest("Даты начала и окончания события не могут отстоять более чем на 3 дня");

        // Validate both times are within club working hours
        if (!TimeSpan.TryParse(club.OpenTime, out var openTime) ||
            !TimeSpan.TryParse(club.CloseTime, out var closeTime))
            return BadRequest("Неверные часы работы клуба");

        var startTimeOfDay = req.StartTime.TimeOfDay;
        var endTimeOfDay = req.EndTime.TimeOfDay;
        if (startTimeOfDay < openTime || startTimeOfDay >= closeTime)
            return BadRequest($"Время начала события должно быть в рабочее время клуба ({club.OpenTime}–{club.CloseTime})");
        if (endTimeOfDay <= openTime || endTimeOfDay > closeTime)
            return BadRequest($"Время окончания события должно быть в рабочее время клуба ({club.OpenTime}–{club.CloseTime})");

        var ev = new ClubEvent
        {
            ClubId = club.Id,
            Title = req.Title,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            MaxParticipants = req.MaxParticipants,
            EventType = req.EventType,
            GameSystem = req.GameSystem,
            TableIds = req.TableIds
        };
        _db.ClubEvents.Add(ev);
        _db.SaveChanges();
        return Ok(new { ev.Id, ev.Title, ev.StartTime, ev.EndTime, ev.MaxParticipants, ev.EventType, ev.GameSystem, ev.TableIds });
    }

    [HttpDelete("events/{id}")]
    public IActionResult DeleteEvent(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == id && e.ClubId == club.Id);
        if (ev == null) return NotFound();
        _db.ClubEvents.Remove(ev);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpPut("events/{id}/title")]
    public IActionResult UpdateEventTitle(int id, [FromBody] UpdateEventTitleRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest("Название события не может быть пустым");

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == id && e.ClubId == club.Id);
        if (ev == null) return NotFound();

        ev.Title = req.Title.Trim();
        _db.SaveChanges();
        return Ok(new { ev.Id, ev.Title });
    }

    [HttpPut("events/{id}/date")]
    public IActionResult UpdateEventDate(int id, [FromBody] UpdateEventDateRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == id && e.ClubId == club.Id);
        if (ev == null) return NotFound();

        // Validate whole hours only
        if (req.StartTime.Minute != 0 || req.StartTime.Second != 0)
            return BadRequest("Время начала события должно быть на ровный час");
        if (req.EndTime.Minute != 0 || req.EndTime.Second != 0)
            return BadRequest("Время окончания события должно быть на ровный час");

        if (req.EndTime <= req.StartTime)
            return BadRequest("Время окончания должно быть позже времени начала");

        if ((req.EndTime - req.StartTime).TotalDays > 3)
            return BadRequest("Даты начала и окончания события не могут отстоять более чем на 3 дня");

        // Validate within club working hours
        if (!TimeSpan.TryParse(club.OpenTime, out var openTime) ||
            !TimeSpan.TryParse(club.CloseTime, out var closeTime))
            return BadRequest("Неверные часы работы клуба");

        var startTimeOfDay = req.StartTime.TimeOfDay;
        var endTimeOfDay = req.EndTime.TimeOfDay;
        if (startTimeOfDay < openTime || startTimeOfDay >= closeTime)
            return BadRequest($"Время начала события должно быть в рабочее время клуба ({club.OpenTime}–{club.CloseTime})");
        if (endTimeOfDay <= openTime || endTimeOfDay > closeTime)
            return BadRequest($"Время окончания события должно быть в рабочее время клуба ({club.OpenTime}–{club.CloseTime})");

        ev.StartTime = req.StartTime;
        ev.EndTime = req.EndTime;
        _db.SaveChanges();
        return Ok(new { ev.Id, ev.StartTime, ev.EndTime });
    }

    [HttpPost("events/{id}/participants/{userId}")]
    public IActionResult InviteParticipant(int id, string userId)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();

        var ev = _db.ClubEvents.Include(e => e.Participants).FirstOrDefault(e => e.Id == id && e.ClubId == club.Id);
        if (ev == null) return NotFound();

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == club.Id && m.Status == "Approved");
        if (!isMember) return BadRequest("Пользователь не является одобренным участником клуба");

        if (ev.Participants.Any(p => p.UserId == userId))
            return BadRequest("Игрок уже участвует в событии");

        if (ev.Participants.Count >= ev.MaxParticipants)
            return BadRequest("Событие заполнено");

        var user = _db.Users.FirstOrDefault(u => u.Id == userId);
        _db.EventParticipants.Add(new EventParticipant { EventId = id, UserId = userId });
        _db.SaveChanges();

        return Ok(new { Id = userId, Name = user?.DisplayName ?? user?.Name ?? userId });
    }

    [HttpDelete("events/{id}/participants/{userId}")]
    public IActionResult RemoveParticipant(int id, string userId)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();

        var ev = _db.ClubEvents.FirstOrDefault(e => e.Id == id && e.ClubId == club.Id);
        if (ev == null) return NotFound();

        var participant = _db.EventParticipants.FirstOrDefault(p => p.EventId == id && p.UserId == userId);
        if (participant == null) return NotFound();

        _db.EventParticipants.Remove(participant);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpPut("memberships/{id}/game-systems")]
    public IActionResult UpdateMemberGameSystems(int id, [FromBody] UpdateMemberGameSystemsRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var membership = _db.Memberships.Include(m => m.User).FirstOrDefault(m => m.Id == id && m.ClubId == club.Id && m.Status == "Approved");
        if (membership == null) return NotFound();
        if (membership.IsManualEntry || membership.User == null) return BadRequest("Нельзя задать игровые системы для записи, добавленной вручную");
        var systems = req.EnabledGameSystems ?? new List<string>();
        var invalid = systems.Where(s => !GameSystemConstants.All.Contains(s)).ToList();
        if (invalid.Count > 0) return BadRequest($"Неизвестные игровые системы: {string.Join(", ", invalid)}");
        membership.User.EnabledGameSystems = systems.Count > 0 ? string.Join("|", systems) : null;
        _db.SaveChanges();
        return Ok(new { membership.User.EnabledGameSystems });
    }

    [HttpGet("decorations")]
    public IActionResult GetDecorations()
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var decorations = _db.ClubDecorations
            .Where(d => d.ClubId == club.Id)
            .Select(d => new { d.Id, d.Type, d.X, d.Y, d.Width, d.Height })
            .ToList();
        return Ok(decorations);
    }

    [HttpPost("decorations")]
    public IActionResult CreateDecoration([FromBody] DecorationRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var allowed = new[] { "wall", "window", "door" };
        if (!allowed.Contains(req.Type)) return BadRequest("Invalid type");
        var deco = new ClubDecoration { ClubId = club.Id, Type = req.Type, X = req.X, Y = req.Y, Width = req.Width, Height = req.Height };
        _db.ClubDecorations.Add(deco);
        _db.SaveChanges();
        return Ok(new { deco.Id, deco.Type, deco.X, deco.Y, deco.Width, deco.Height });
    }

    [HttpPut("decorations/{id}")]
    public IActionResult UpdateDecoration(int id, [FromBody] DecorationRequest req)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var deco = _db.ClubDecorations.FirstOrDefault(d => d.Id == id && d.ClubId == club.Id);
        if (deco == null) return NotFound();
        var allowed = new[] { "wall", "window", "door" };
        if (!allowed.Contains(req.Type)) return BadRequest("Invalid type");
        deco.Type = req.Type;
        deco.X = req.X;
        deco.Y = req.Y;
        deco.Width = req.Width;
        deco.Height = req.Height;
        _db.SaveChanges();
        return Ok(new { deco.Id, deco.Type, deco.X, deco.Y, deco.Width, deco.Height });
    }

    [HttpDelete("decorations/{id}")]
    public IActionResult DeleteDecoration(int id)
    {
        var club = GetAuthorizedClub();
        if (club == null) return Unauthorized();
        var deco = _db.ClubDecorations.FirstOrDefault(d => d.Id == id && d.ClubId == club.Id);
        if (deco == null) return NotFound();
        _db.ClubDecorations.Remove(deco);
        _db.SaveChanges();
        return NoContent();
    }
}

public record TableRequest(string Number, string Size, string SupportedGames, double X, double Y, double Width, double Height, bool EventsOnly = false);
public record ClubSettingsRequest(string OpenTime, string CloseTime);
public record ClubEventRequest(string Title, DateTime StartTime, DateTime EndTime, int MaxParticipants, string EventType, string? GameSystem, string? TableIds);
public record UpdateEventDateRequest(DateTime StartTime, DateTime EndTime);
public record UpdateEventTitleRequest(string Title);
public record SetModeratorRequest(bool IsModerator);
public record UpdateMemberGameSystemsRequest(List<string>? EnabledGameSystems);
public record DecorationRequest(string Type, double X, double Y, double Width, double Height);
public record ManualMemberRequest(string Name, string? Email);
