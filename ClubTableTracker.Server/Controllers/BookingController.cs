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
public class BookingController : ControllerBase
{
    private readonly AppDbContext _db;
    private const int MaxBookingDaysAhead = 30;

    public BookingController(AppDbContext db) => _db = db;

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet("club/{clubId}")]
    public IActionResult GetBookings(int clubId)
    {
        var userId = GetUserId();
        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == clubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.Table.ClubId == clubId)
            .ToList()
            .Select(b => new
            {
                b.Id,
                b.TableId,
                b.StartTime,
                b.EndTime,
                b.GameSystem,
                b.IsDoubles,
                b.IsForOthers,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new {
                    ParticipantId = p.Id,
                    Id = p.UserId ?? $"manual:{p.ManualMembershipId}",
                    Name = p.UserId != null ? (p.User?.DisplayName ?? p.User?.Name ?? "") : (p.ManualName ?? ""),
                    p.Status
                })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("my-upcoming")]
    public IActionResult GetMyUpcoming()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var now = DateTime.UtcNow;
        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Table).ThenInclude(t => t.Club)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.EndTime > now &&
                        (b.UserId == userId || b.Participants.Any(p => p.UserId == userId)) &&
                        _db.Memberships.Any(m => m.UserId == userId && m.ClubId == b.Table.ClubId && m.Status == "Approved"))
            .OrderBy(b => b.StartTime)
            .ToList()
            .Select(b => new
            {
                b.Id,
                b.TableId,
                TableNumber = b.Table.Number,
                ClubName = b.Table.Club.Name,
                ClubId = b.Table.ClubId,
                b.StartTime,
                b.EndTime,
                b.GameSystem,
                b.IsDoubles,
                b.IsForOthers,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new {
                    ParticipantId = p.Id,
                    Id = p.UserId ?? $"manual:{p.ManualMembershipId}",
                    Name = p.UserId != null ? (p.User?.DisplayName ?? p.User?.Name ?? "") : (p.ManualName ?? ""),
                    p.Status
                })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("upcoming-all")]
    public IActionResult GetUpcomingAll()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var approvedClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved")
            .Select(m => m.ClubId)
            .ToList();

        var now = DateTime.UtcNow;
        var bookings = _db.Bookings
            .Include(b => b.User)
            .Include(b => b.Table).ThenInclude(t => t.Club)
            .Include(b => b.Participants).ThenInclude(p => p.User)
            .Where(b => b.EndTime > now && approvedClubIds.Contains(b.Table.ClubId))
            .OrderBy(b => b.StartTime)
            .ToList()
            .Select(b => new
            {
                b.Id,
                b.TableId,
                TableNumber = b.Table.Number,
                ClubName = b.Table.Club.Name,
                ClubId = b.Table.ClubId,
                b.StartTime,
                b.EndTime,
                b.GameSystem,
                b.IsDoubles,
                b.IsForOthers,
                User = new { b.User.Id, Name = b.User.DisplayName ?? b.User.Name },
                Participants = b.Participants.Select(p => new {
                    ParticipantId = p.Id,
                    Id = p.UserId ?? $"manual:{p.ManualMembershipId}",
                    Name = p.UserId != null ? (p.User?.DisplayName ?? p.User?.Name ?? "") : (p.ManualName ?? ""),
                    p.Status
                })
            })
            .ToList();
        return Ok(bookings);
    }

    [HttpGet("activity-log")]
    public IActionResult GetActivityLog()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var approvedClubIds = _db.Memberships
            .Where(m => m.UserId == userId && m.Status == "Approved")
            .Select(m => m.ClubId)
            .ToList();

        var since = DateTime.UtcNow.AddMonths(-1);
        var logs = _db.BookingLogs
            .Include(l => l.User)
            .Where(l => l.Timestamp >= since && approvedClubIds.Contains(l.ClubId))
            .OrderByDescending(l => l.Timestamp)
            .Select(l => new
            {
                l.Id,
                Timestamp = DateTime.SpecifyKind(l.Timestamp, DateTimeKind.Utc),
                l.Action,
                UserName = l.User.DisplayName ?? l.User.Name,
                l.TableNumber,
                l.ClubId,
                BookingStartTime = DateTime.SpecifyKind(l.BookingStartTime, DateTimeKind.Unspecified),
                BookingEndTime = DateTime.SpecifyKind(l.BookingEndTime, DateTimeKind.Unspecified)
            })
            .ToList();
        return Ok(logs);
    }

    [HttpPost]
    public IActionResult CreateBooking([FromBody] CreateBookingRequest req)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (req.StartTime >= req.EndTime) return BadRequest("End time must be after start time");
        if (req.StartTime < DateTime.UtcNow) return BadRequest("Booking must be in the future");
        var table = _db.GameTables.Find(req.TableId);
        if (table == null) return NotFound("Table not found");

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == table.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        if (req.StartTime > DateTime.UtcNow.AddDays(MaxBookingDaysAhead))
        {
            // Участники кампании могут бронировать столы на весь срок кампании, не ограничиваясь стандартным окном
            var isCampaignParticipant = _db.ClubEvents
                .Include(e => e.Participants)
                .Where(e => e.EventType == "Campaign"
                            && e.ClubId == table.ClubId
                            && e.StartTime <= req.StartTime
                            && e.EndTime > req.StartTime
                            && e.TableIds != null)
                .ToList()
                .Any(e => e.TableIds!.Split(',').Select(id => id.Trim()).Contains(req.TableId.ToString())
                         && e.Participants.Any(p => p.UserId == userId));
            if (!isCampaignParticipant)
                return BadRequest($"Бронирование можно делать не более чем на {MaxBookingDaysAhead} дней вперёд");
        }

        // Validate booking falls within club working hours
        var club = _db.Clubs.Find(table.ClubId);
        if (club == null) return NotFound("Club not found");

        if (!TimeSpan.TryParse(club.OpenTime, out var openSpan) || !TimeSpan.TryParse(club.CloseTime, out var closeSpan))
            return BadRequest("Некорректная конфигурация рабочего времени клуба");

        int openMinutes = (int)openSpan.TotalMinutes;
        int closeMinutes = (int)closeSpan.TotalMinutes;
        int startMinOfDay = req.StartTime.Hour * 60 + req.StartTime.Minute;
        int endMinOfDay = req.EndTime.Hour * 60 + req.EndTime.Minute;

        if (startMinOfDay < openMinutes || endMinOfDay > closeMinutes)
            return BadRequest($"Время бронирования должно быть в рамках рабочего времени клуба ({club.OpenTime}–{club.CloseTime})");

        // Check for time conflicts (no overlapping bookings allowed; touching boundaries are OK)
        var hasConflict = _db.Bookings
            .Any(b => b.TableId == req.TableId &&
                      b.StartTime < req.EndTime &&
                      b.EndTime > req.StartTime);

        if (hasConflict) return BadRequest("Table is already booked during the requested time period. Please choose a different time slot.");

        // Check event-based restrictions (Campaign events do not restrict table booking)
        var eventsOnTable = _db.ClubEvents
            .Include(e => e.Participants)
            .Where(e => e.ClubId == table.ClubId
                        && e.EventType != "Campaign"
                        && e.StartTime < req.EndTime
                        && e.EndTime > req.StartTime
                        && e.TableIds != null)
            .ToList()
            .Where(e => e.TableIds!.Split(',').Select(id => id.Trim()).Contains(req.TableId.ToString()))
            .ToList();

        if (eventsOnTable.Count > 0)
        {
            // Table is assigned to an event during this time — only registered participants may book it
            var isRegistered = eventsOnTable.Any(e => e.Participants.Any(p => p.UserId == userId));
            if (!isRegistered)
                return BadRequest("Этот стол зарезервирован для участников события. Запишитесь на событие, чтобы забронировать стол.");
        }
        else if (table.EventsOnly)
        {
            // Table is marked "events only" but no event is scheduled during this time
            return BadRequest("Этот стол доступен только во время событий клуба.");
        }

        // Режим "Для других" — модератор создаёт игру за других участников, сам не играет
        if (req.IsForOthers)
        {
            var isModerator = _db.Memberships.Any(m =>
                m.UserId == userId && m.ClubId == table.ClubId &&
                m.Status == "Approved" && m.IsModerator);
            if (!isModerator)
                return Forbid();

            if (req.InvitedUserIds == null || req.InvitedUserIds.Count == 0)
                return BadRequest("В режиме «Для других» необходимо выбрать хотя бы одного участника");

            // Первый реальный (не __RESERVED__) участник становится владельцем бронирования.
            // Если все слоты — __RESERVED__, владельцем становится модератор.
            var firstReal = req.InvitedUserIds.FirstOrDefault(id =>
                !string.IsNullOrEmpty(id) && id != BookingConstants.ReservedUserId);
            bool allReserved = firstReal == null;
            string ownerId = firstReal ?? userId;

            if (!allReserved)
            {
                var isFirstMember = _db.Memberships.Any(m =>
                    m.UserId == firstReal && m.ClubId == table.ClubId && m.Status == "Approved");
                if (!isFirstMember)
                    return BadRequest("Первый участник не является членом клуба");
            }

            var booking = new Booking
            {
                TableId = req.TableId,
                UserId = ownerId,
                StartTime = req.StartTime,
                EndTime = req.EndTime,
                GameSystem = req.GameSystem,
                IsDoubles = req.IsDoubles,
                IsForOthers = true
            };
            _db.Bookings.Add(booking);
            _db.SaveChanges();

            // Оставшиеся участники добавляются как Participants Accepted.
            // Когда все ЗАБРОНИРОВАНО: модератор — владелец (не в числе игроков),
            // поэтому все maxSlots слотов отдаются участникам.
            int maxSlots = req.IsDoubles ? 4 : 2;
            // Когда все ЗАБРОНИРОВАНО — модератор не является игроком, не дедуплицируем его.
            // Когда есть реальный первый участник — исключаем его из участников (он уже owner).
            var seenForOthers = allReserved ? new HashSet<string>() : new HashSet<string> { ownerId };
            int participantSlots = allReserved ? maxSlots : maxSlots - 1;
            var remainingInvitees = req.InvitedUserIds
                .Where(id => !string.IsNullOrEmpty(id) && (allReserved || id != firstReal))
                .Where(id => id == BookingConstants.ReservedUserId || seenForOthers.Add(id))
                .Take(participantSlots)
                .ToList();

            foreach (var inviteeId in remainingInvitees)
            {
                if (inviteeId == BookingConstants.ReservedUserId)
                {
                    _db.BookingParticipants.Add(new BookingParticipant
                    {
                        BookingId = booking.Id,
                        UserId = inviteeId,
                        Status = "Accepted"
                    });
                    continue;
                }

                var isMember2 = _db.Memberships.Any(m =>
                    m.UserId == inviteeId && m.ClubId == table.ClubId && m.Status == "Approved");
                if (!isMember2) continue;

                bool canAdd = true;
                if (!string.IsNullOrEmpty(req.GameSystem))
                {
                    var invitee = _db.Users.Find(inviteeId);
                    if (invitee != null)
                    {
                        var systems = invitee.EnabledGameSystems?.Split('|', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();
                        canAdd = systems.Contains(req.GameSystem);
                    }
                    else
                    {
                        canAdd = false;
                    }
                }

                if (canAdd)
                {
                    _db.BookingParticipants.Add(new BookingParticipant
                    {
                        BookingId = booking.Id,
                        UserId = inviteeId,
                        Status = "Accepted"
                    });
                }
            }

            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = DateTime.UtcNow,
                Action = "Booked",
                UserId = userId,
                BookingId = booking.Id,
                TableNumber = table.Number,
                ClubId = table.ClubId,
                BookingStartTime = req.StartTime,
                BookingEndTime = req.EndTime
            });
            _db.SaveChanges();

            return Ok(new { booking.Id, booking.TableId, booking.StartTime, booking.EndTime, booking.GameSystem });
        }

        var normalBooking = new Booking
        {
            TableId = req.TableId,
            UserId = userId,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            GameSystem = req.GameSystem,
            IsDoubles = req.IsDoubles
        };
        _db.Bookings.Add(normalBooking);
        _db.SaveChanges();

        // Если указаны оппоненты — создаём приглашения
        if (req.InvitedUserIds != null && req.InvitedUserIds.Count > 0)
        {
            int maxInvites = req.IsDoubles ? 3 : 1;
            // Дедуплицируем только реальных пользователей; виртуальный __RESERVED__ может
            // повторяться (каждое вхождение — отдельная занятая позиция в 2x2).
            var seenUsers = new HashSet<string>();
            var validInvitees = req.InvitedUserIds
                .Where(id => !string.IsNullOrEmpty(id) && id != userId)
                .Where(id => id == BookingConstants.ReservedUserId || seenUsers.Add(id))
                .Take(maxInvites)
                .ToList();

            foreach (var inviteeId in validInvitees)
            {
                // Виртуальный игрок "ЗАБРОНИРОВАНО" — создаём занятый слот без проверки членства/системы
                if (inviteeId == BookingConstants.ReservedUserId)
                {
                    _db.BookingParticipants.Add(new BookingParticipant
                    {
                        BookingId = normalBooking.Id,
                        UserId = inviteeId,
                        Status = "Accepted"
                    });
                    continue;
                }

                var isInviteeMember = _db.Memberships.Any(m => m.UserId == inviteeId && m.ClubId == table.ClubId && m.Status == "Approved");
                if (!isInviteeMember) continue;

                // Проверяем, что у приглашённого включена выбранная игровая система
                bool canInvite = true;
                if (!string.IsNullOrEmpty(req.GameSystem))
                {
                    var invitee = _db.Users.Find(inviteeId);
                    if (invitee != null)
                    {
                        var inviteeSystems = invitee.EnabledGameSystems?.Split('|', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();
                        canInvite = inviteeSystems.Contains(req.GameSystem);
                    }
                    else
                    {
                        canInvite = false;
                    }
                }

                if (canInvite)
                {
                    _db.BookingParticipants.Add(new BookingParticipant
                    {
                        BookingId = normalBooking.Id,
                        UserId = inviteeId,
                        Status = "Invited"
                    });
                }
            }
        }

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Booked",
            UserId = userId,
            BookingId = normalBooking.Id,
            TableNumber = table.Number,
            ClubId = table.ClubId,
            BookingStartTime = req.StartTime,
            BookingEndTime = req.EndTime
        });
        _db.SaveChanges();

        return Ok(new { normalBooking.Id, normalBooking.TableId, normalBooking.StartTime, normalBooking.EndTime, normalBooking.GameSystem });
    }

    [HttpPost("{id}/join")]
    public IActionResult JoinBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var isMember = _db.Memberships.Any(m => m.UserId == userId && m.ClubId == booking.Table.ClubId && m.Status == "Approved");
        if (!isMember) return Forbid();

        if (booking.UserId == userId || booking.Participants.Any(p => p.UserId == userId))
            return BadRequest("Already in this booking");

        int maxPlayers = booking.IsDoubles ? 4 : 2;
        if (1 + booking.Participants.Count(p => p.Status == "Accepted") >= maxPlayers)
            return BadRequest($"Booking is full (max {maxPlayers} players)");

        var participant = new BookingParticipant { BookingId = id, UserId = userId, Status = "Accepted" };
        _db.BookingParticipants.Add(participant);

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Joined",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        });

        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}/leave")]
    public IActionResult LeaveBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants.FirstOrDefault(p => p.BookingId == id && p.UserId == userId);
        if (participant == null) return NotFound();

        var booking = _db.Bookings.Include(b => b.Table).FirstOrDefault(b => b.Id == id);

        _db.BookingParticipants.Remove(participant);

        if (booking != null)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = DateTime.UtcNow,
                Action = "Left",
                UserId = userId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
        }

        _db.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public IActionResult DeleteBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id && b.UserId == userId);
        if (booking == null) return NotFound();

        var log = new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Cancelled",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        };

        // Передаём владение только принятым реальным участникам (Status == "Accepted", не виртуальный RESERVED, не ручной)
        var acceptedParticipants = booking.Participants.Where(p => p.Status == "Accepted" && p.UserId != null && p.UserId != BookingConstants.ReservedUserId).OrderBy(p => p.Id).ToList();
        if (acceptedParticipants.Count > 0)
        {
            var newOwner = acceptedParticipants.First();
            booking.UserId = newOwner.UserId!;
            _db.BookingParticipants.Remove(newOwner);
            var invitedParticipants = booking.Participants.Where(p => p.Status == "Invited").ToList();
            _db.BookingParticipants.RemoveRange(invitedParticipants);
            _db.BookingLogs.Add(log);
            _db.SaveChanges();
        }
        else
        {
            // Нет принятых участников — удаляем бронирование полностью
            _db.BookingLogs.Add(log);
            _db.Bookings.Remove(booking);
            _db.SaveChanges();
        }

        return NoContent();
    }

    [HttpDelete("{id}/annul")]
    public IActionResult AnnulBooking(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id && b.UserId == userId);
        if (booking == null) return NotFound();

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Cancelled",
            UserId = userId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = booking.Table.ClubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        });

        _db.Bookings.Remove(booking); // Cascade удалит всех участников
        _db.SaveChanges();
        return NoContent();
    }

    [HttpPost("{id}/accept-invite")]
    public IActionResult AcceptInvite(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants
            .Include(p => p.Booking).ThenInclude(b => b.Table)
            .FirstOrDefault(p => p.BookingId == id && p.UserId == userId && p.Status == "Invited");
        if (participant == null) return NotFound();

        // Убедимся, что место ещё свободно
        var acceptedCount = _db.BookingParticipants.Count(p => p.BookingId == id && p.Status == "Accepted");
        int maxPlayers = participant.Booking.IsDoubles ? 4 : 2;
        if (1 + acceptedCount >= maxPlayers)
            return BadRequest($"Booking is full (max {maxPlayers} players)");

        participant.Status = "Accepted";

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Joined",
            UserId = userId,
            BookingId = id,
            TableNumber = participant.Booking.Table.Number,
            ClubId = participant.Booking.Table.ClubId,
            BookingStartTime = participant.Booking.StartTime,
            BookingEndTime = participant.Booking.EndTime
        });

        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}/decline-invite")]
    public IActionResult DeclineInvite(int id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var participant = _db.BookingParticipants
            .FirstOrDefault(p => p.BookingId == id && p.UserId == userId && p.Status == "Invited");
        if (participant == null) return NotFound();

        _db.BookingParticipants.Remove(participant);
        _db.SaveChanges();
        return NoContent();
    }

    [HttpDelete("{id}/kick-player/{targetUserId}")]
    public IActionResult KickPlayerFromBooking(int id, string targetUserId)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var isModerator = _db.Memberships.Any(m =>
            m.UserId == callerId && m.ClubId == booking.Table.ClubId &&
            m.Status == "Approved" && m.IsModerator);
        if (!isModerator) return Forbid();

        var now = DateTime.UtcNow;

        if (booking.UserId == targetUserId)
        {
            // Transfer ownership to first accepted real participant, or delete booking
            var acceptedParticipants = booking.Participants.Where(p => p.Status == "Accepted" && p.UserId != null && p.UserId != BookingConstants.ReservedUserId).OrderBy(p => p.Id).ToList();
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = now,
                Action = "Cancelled",
                UserId = targetUserId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
            if (acceptedParticipants.Count > 0)
            {
                var newOwner = acceptedParticipants.First();
                booking.UserId = newOwner.UserId!;
                _db.BookingParticipants.Remove(newOwner);
                var invitedParticipants = booking.Participants.Where(p => p.Status == "Invited").ToList();
                _db.BookingParticipants.RemoveRange(invitedParticipants);
            }
            else
            {
                _db.Bookings.Remove(booking);
            }
        }
        else
        {
            var participant = booking.Participants.FirstOrDefault(p => p.UserId == targetUserId);
            if (participant == null) return NotFound();
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = now,
                Action = "Left",
                UserId = targetUserId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
            _db.BookingParticipants.Remove(participant);
        }

        _db.SaveChanges();
        return NoContent();
    }

    [HttpPatch("{id}/move-table")]
    public IActionResult MoveBookingTable(int id, [FromBody] MoveTableRequest req)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var clubId = booking.Table.ClubId;

        var isModerator = _db.Memberships.Any(m =>
            m.UserId == callerId && m.ClubId == clubId &&
            m.Status == "Approved" && m.IsModerator);
        if (!isModerator) return Forbid();

        if (req.NewTableId == booking.TableId)
            return BadRequest("Игра уже находится на этом столе");

        var newTable = _db.GameTables.Find(req.NewTableId);
        if (newTable == null) return NotFound("Стол не найден");

        if (newTable.ClubId != clubId)
            return BadRequest("Стол должен принадлежать тому же клубу");

        // Check that new table supports the booking's game system
        if (!string.IsNullOrEmpty(booking.GameSystem))
        {
            var supported = newTable.SupportedGames
                .Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim());
            if (!supported.Contains(booking.GameSystem))
                return BadRequest($"Стол не поддерживает игровую систему «{booking.GameSystem}»");
        }

        // Check that new table is free during the booking's time window
        var hasConflict = _db.Bookings.Any(b =>
            b.TableId == req.NewTableId &&
            b.Id != id &&
            b.StartTime < booking.EndTime &&
            b.EndTime > booking.StartTime);
        if (hasConflict) return BadRequest("Выбранный стол уже занят в это время");

        booking.TableId = req.NewTableId;

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "MovedTable",
            UserId = callerId,
            BookingId = booking.Id,
            TableNumber = newTable.Number,
            ClubId = clubId,
            BookingStartTime = booking.StartTime,
            BookingEndTime = booking.EndTime
        });

        _db.SaveChanges();
        return Ok(new { booking.Id, booking.TableId, TableNumber = newTable.Number });
    }

    [HttpPatch("{id}/reschedule")]
    public IActionResult RescheduleBooking(int id, [FromBody] RescheduleBookingRequest req)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var clubId = booking.Table.ClubId;

        var isOwner = booking.UserId == callerId;
        var isModerator = _db.Memberships.Any(m =>
            m.UserId == callerId && m.ClubId == clubId &&
            m.Status == "Approved" && m.IsModerator);

        if (!isOwner && !isModerator) return Forbid();

        // Same time validations as CreateBooking
        if (req.StartTime >= req.EndTime) return BadRequest("End time must be after start time");
        if (req.StartTime < DateTime.UtcNow) return BadRequest("Booking must be in the future");
        if (req.StartTime > DateTime.UtcNow.AddDays(MaxBookingDaysAhead))
        {
            // Участники кампании могут переносить бронирования на весь срок кампании
            var isCampaignParticipant = _db.ClubEvents
                .Include(e => e.Participants)
                .Where(e => e.EventType == "Campaign"
                            && e.ClubId == clubId
                            && e.StartTime <= req.StartTime
                            && e.EndTime > req.StartTime
                            && e.TableIds != null)
                .ToList()
                .Any(e => e.TableIds!.Split(',').Select(id => id.Trim()).Contains(booking.TableId.ToString())
                         && e.Participants.Any(p => p.UserId == callerId));
            if (!isCampaignParticipant)
                return BadRequest($"Бронирование можно делать не более чем на {MaxBookingDaysAhead} дней вперёд");
        }

        // Time change is only allowed within the same calendar day as the original booking
        if (req.StartTime.Date != booking.StartTime.Date)
            return BadRequest("Время можно изменить только в пределах этого дня");

        var club = _db.Clubs.Find(clubId);
        if (club == null) return NotFound("Club not found");

        if (!TimeSpan.TryParse(club.OpenTime, out var openSpan) || !TimeSpan.TryParse(club.CloseTime, out var closeSpan))
            return BadRequest("Некорректная конфигурация рабочего времени клуба");

        int openMinutes = (int)openSpan.TotalMinutes;
        int closeMinutes = (int)closeSpan.TotalMinutes;
        int startMinOfDay = req.StartTime.Hour * 60 + req.StartTime.Minute;
        int endMinOfDay = req.EndTime.Hour * 60 + req.EndTime.Minute;

        if (startMinOfDay < openMinutes || endMinOfDay > closeMinutes)
            return BadRequest($"Время бронирования должно быть в рамках рабочего времени клуба ({club.OpenTime}–{club.CloseTime})");

        // Conflict check — exclude current booking
        var hasConflict = _db.Bookings
            .Any(b => b.TableId == booking.TableId &&
                      b.Id != id &&
                      b.StartTime < req.EndTime &&
                      b.EndTime > req.StartTime);

        if (hasConflict) return BadRequest("Table is already booked during the requested time period. Please choose a different time slot.");

        // Event-based restrictions (Campaign events do not restrict table booking)
        var eventsOnTable = _db.ClubEvents
            .Include(e => e.Participants)
            .Where(e => e.ClubId == clubId
                        && e.EventType != "Campaign"
                        && e.StartTime < req.EndTime
                        && e.EndTime > req.StartTime
                        && e.TableIds != null)
            .ToList()
            .Where(e => e.TableIds!.Split(',').Select(t => t.Trim()).Contains(booking.TableId.ToString()))
            .ToList();

        if (eventsOnTable.Count > 0)
        {
            var isRegistered = eventsOnTable.Any(e => e.Participants.Any(p => p.UserId == booking.UserId));
            if (!isRegistered)
                return BadRequest("Этот стол зарезервирован для участников события. Запишитесь на событие, чтобы забронировать стол.");
        }
        else if (booking.Table.EventsOnly)
        {
            return BadRequest("Этот стол доступен только во время событий клуба.");
        }

        booking.StartTime = req.StartTime;
        booking.EndTime = req.EndTime;

        _db.BookingLogs.Add(new BookingLog
        {
            Timestamp = DateTime.UtcNow,
            Action = "Rescheduled",
            UserId = callerId,
            BookingId = booking.Id,
            TableNumber = booking.Table.Number,
            ClubId = clubId,
            BookingStartTime = req.StartTime,
            BookingEndTime = req.EndTime
        });

        _db.SaveChanges();
        return Ok(new { booking.Id, booking.TableId, booking.StartTime, booking.EndTime });
    }

    [HttpDelete("{id}/kick-participant/{participantId:int}")]
    public IActionResult KickParticipantFromBooking(int id, int participantId)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var isModerator = _db.Memberships.Any(m =>
            m.UserId == callerId && m.ClubId == booking.Table.ClubId &&
            m.Status == "Approved" && m.IsModerator);
        if (!isModerator) return Forbid();

        var participant = booking.Participants.FirstOrDefault(p => p.Id == participantId);
        if (participant == null) return NotFound("Participant not found in this booking");

        var now = DateTime.UtcNow;
        if (participant.UserId != null)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = now,
                Action = "Left",
                UserId = participant.UserId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
        }
        _db.BookingParticipants.Remove(participant);

        _db.SaveChanges();
        return NoContent();
    }

    [HttpPost("{id}/add-player")]
    public IActionResult AddPlayerToBooking(int id, [FromBody] AddPlayerRequest req)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        var isModerator = _db.Memberships.Any(m =>
            m.UserId == callerId && m.ClubId == booking.Table.ClubId &&
            m.Status == "Approved" && m.IsModerator);
        if (!isModerator) return Forbid();

        // Поддержка ручных участников: userId имеет вид "manual:{membershipId}"
        if (req.UserId.StartsWith("manual:", StringComparison.Ordinal))
        {
            if (!int.TryParse(req.UserId["manual:".Length..], out var membershipId))
                return BadRequest("Некорректный идентификатор игрока");

            var membership = _db.Memberships.FirstOrDefault(m =>
                m.Id == membershipId && m.ClubId == booking.Table.ClubId &&
                m.Status == "Approved" && m.IsManualEntry);
            if (membership == null) return BadRequest("Игрок не является членом клуба");

            if (booking.Participants.Any(p => p.ManualMembershipId == membershipId))
                return BadRequest("Игрок уже участвует в этой игре");

            int maxPlayersManual = booking.IsDoubles ? 4 : 2;
            int acceptedCountManual = 1 + booking.Participants.Count(p => p.Status == "Accepted");
            if (acceptedCountManual >= maxPlayersManual)
                return BadRequest($"Нет свободных мест (max {maxPlayersManual})");

            _db.BookingParticipants.Add(new BookingParticipant
            {
                BookingId = id,
                ManualMembershipId = membershipId,
                ManualName = membership.ManualName,
                Status = "Accepted"
            });
            _db.SaveChanges();
            return Ok();
        }

        if (req.UserId != BookingConstants.ReservedUserId)
        {
            var isTargetMember = _db.Memberships.Any(m =>
                m.UserId == req.UserId && m.ClubId == booking.Table.ClubId && m.Status == "Approved");
            if (!isTargetMember) return BadRequest("Игрок не является членом клуба");

            if (booking.UserId == req.UserId || booking.Participants.Any(p => p.UserId == req.UserId))
                return BadRequest("Игрок уже участвует в этой игре");
        }

        int maxPlayers = booking.IsDoubles ? 4 : 2;
        int acceptedCount = 1 + booking.Participants.Count(p => p.Status == "Accepted");
        if (acceptedCount >= maxPlayers)
            return BadRequest($"Нет свободных мест (max {maxPlayers})");

        _db.BookingParticipants.Add(new BookingParticipant
        {
            BookingId = id,
            UserId = req.UserId,
            Status = "Accepted"
        });

        if (req.UserId != BookingConstants.ReservedUserId)
        {
            _db.BookingLogs.Add(new BookingLog
            {
                Timestamp = DateTime.UtcNow,
                Action = "Joined",
                UserId = req.UserId,
                BookingId = booking.Id,
                TableNumber = booking.Table.Number,
                ClubId = booking.Table.ClubId,
                BookingStartTime = booking.StartTime,
                BookingEndTime = booking.EndTime
            });
        }

        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("{id}/invite-player")]
    public IActionResult InvitePlayerToBooking(int id, [FromBody] AddPlayerRequest req)
    {
        var callerId = GetUserId();
        if (callerId == null) return Unauthorized();

        var booking = _db.Bookings
            .Include(b => b.Table)
            .Include(b => b.Participants)
            .FirstOrDefault(b => b.Id == id);
        if (booking == null) return NotFound();

        if (booking.UserId != callerId) return Forbid();

        // Поддержка ручных участников: userId имеет вид "manual:{membershipId}"
        if (req.UserId.StartsWith("manual:", StringComparison.Ordinal))
        {
            if (!int.TryParse(req.UserId["manual:".Length..], out var membershipId))
                return BadRequest("Некорректный идентификатор игрока");

            var membership = _db.Memberships.FirstOrDefault(m =>
                m.Id == membershipId && m.ClubId == booking.Table.ClubId &&
                m.Status == "Approved" && m.IsManualEntry);
            if (membership == null) return BadRequest("Игрок не является членом клуба");

            if (booking.Participants.Any(p => p.ManualMembershipId == membershipId))
                return BadRequest("Игрок уже участвует или приглашён в эту игру");

            int maxPlayersManual = booking.IsDoubles ? 4 : 2;
            int takenSlotsManual = 1 + booking.Participants.Count;
            if (takenSlotsManual >= maxPlayersManual)
                return BadRequest($"Нет свободных мест (max {maxPlayersManual})");

            if (!string.IsNullOrEmpty(booking.GameSystem) && !string.IsNullOrEmpty(membership.ManualEnabledGameSystems))
            {
                var memberSystems = membership.ManualEnabledGameSystems.Split('|', StringSplitOptions.RemoveEmptyEntries);
                if (!memberSystems.Contains(booking.GameSystem))
                    return BadRequest($"Игрок не играет в {booking.GameSystem}");
            }

            _db.BookingParticipants.Add(new BookingParticipant
            {
                BookingId = id,
                ManualMembershipId = membershipId,
                ManualName = membership.ManualName,
                Status = "Accepted"
            });
            _db.SaveChanges();
            return Ok();
        }

        if (req.UserId != BookingConstants.ReservedUserId)
        {
            if (req.UserId == callerId) return BadRequest("Нельзя пригласить себя");

            var isTargetMember = _db.Memberships.Any(m =>
                m.UserId == req.UserId && m.ClubId == booking.Table.ClubId && m.Status == "Approved");
            if (!isTargetMember) return BadRequest("Игрок не является членом клуба");

            if (booking.Participants.Any(p => p.UserId == req.UserId))
                return BadRequest("Игрок уже участвует или приглашён в эту игру");
        }

        int maxPlayers = booking.IsDoubles ? 4 : 2;
        int takenSlots = 1 + booking.Participants.Count;
        if (takenSlots >= maxPlayers)
            return BadRequest($"Нет свободных мест (max {maxPlayers})");

        if (req.UserId != BookingConstants.ReservedUserId && !string.IsNullOrEmpty(booking.GameSystem))
        {
            var target = _db.Users.Find(req.UserId);
            if (target != null)
            {
                var targetSystems = target.EnabledGameSystems?.Split('|', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();
                if (!targetSystems.Contains(booking.GameSystem))
                    return BadRequest($"Игрок не играет в {booking.GameSystem}");
            }
        }

        var participantStatus = req.UserId == BookingConstants.ReservedUserId ? "Accepted" : "Invited";
        _db.BookingParticipants.Add(new BookingParticipant
        {
            BookingId = id,
            UserId = req.UserId,
            Status = participantStatus
        });

        _db.SaveChanges();
        return Ok();
    }
}

public record CreateBookingRequest(int TableId, DateTime StartTime, DateTime EndTime, string? GameSystem = null, bool IsDoubles = false, bool IsForOthers = false, List<string>? InvitedUserIds = null);
public record RescheduleBookingRequest(DateTime StartTime, DateTime EndTime);
public record MoveTableRequest(int NewTableId);
public record AddPlayerRequest(string UserId);
