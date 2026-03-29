using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using ClubTableTracker.Server.Data;

namespace ClubTableTracker.Server;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? "Server=localhost;Database=clubtracker;User=root;Password=your-password;";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));
        return new AppDbContext(optionsBuilder.Options);
    }
}
