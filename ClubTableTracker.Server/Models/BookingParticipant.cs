namespace ClubTableTracker.Server.Models;

public class BookingParticipant
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    /// <summary>Null для ручных (безаккаунтных) игроков</summary>
    public string? UserId { get; set; }
    public AppUser? User { get; set; }
    /// <summary>Id записи ClubMembership для ручных игроков (IsManualEntry = true)</summary>
    public int? ManualMembershipId { get; set; }
    public ClubMembership? ManualMembership { get; set; }
    /// <summary>Имя ручного игрока на момент добавления в игру</summary>
    public string? ManualName { get; set; }
    /// <summary>"Invited" — ожидает ответа, "Accepted" — принял приглашение или присоединился самостоятельно</summary>
    public string Status { get; set; } = "Accepted";
    /// <summary>Ростер игрока — многострочное текстовое описание армии/состава</summary>
    public string? Roster { get; set; }
}
