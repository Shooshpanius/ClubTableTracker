namespace ClubTableTracker.Server.Models;

public static class GameSystemConstants
{
    public static readonly string[] All =
    [
        "Warhammer 40,000",
        "Age of Sigmar",
        "The Horus Heresy",
        "Necromunda",
        "Blood Bowl",
        "Warhammer Underworlds",
        "Kill Team",
        "Warcry",
        "Middle-earth Strategy Battle Game",
        "The Old World",
        "Bushido",
        "Battlefleet Gothic",
        "Saga",
        "Trench Crusade",
        "Battletech",
        "Mordheim",
        "Покрас",
        "Настольные игры",
    ];

    public static string AllJoined => string.Join("|", All);
}
