using System;
using System.Collections.Generic;

namespace ClubTableTracker.avalonia.Models;

public class ClubDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string OpenTime { get; set; } = "";
    public string CloseTime { get; set; } = "";
}

public class MembershipDto
{
    public int Id { get; set; }
    public string Status { get; set; } = "";
    public DateTime AppliedAt { get; set; }
    public ClubDto Club { get; set; } = new();
}

public class UserDto
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? EnabledGameSystems { get; set; }
}

public class BookingParticipantDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Status { get; set; } = "";
}

public class BookingUserDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
}

public class BookingDto
{
    public int Id { get; set; }
    public int TableId { get; set; }
    public string TableNumber { get; set; } = "";
    public string ClubName { get; set; } = "";
    public int ClubId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? GameSystem { get; set; }
    public bool IsDoubles { get; set; }
    public BookingUserDto User { get; set; } = new();
    public List<BookingParticipantDto> Participants { get; set; } = new();
}

public class GameTableDto
{
    public int Id { get; set; }
    public int ClubId { get; set; }
    public string Number { get; set; } = "";
    public string Size { get; set; } = "";
    public string SupportedGames { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public bool EventsOnly { get; set; }
}
