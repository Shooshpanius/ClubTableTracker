using Microsoft.EntityFrameworkCore;
using ClubTableTracker.Server.Models;

namespace ClubTableTracker.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Club> Clubs => Set<Club>();
    public DbSet<GameTable> GameTables => Set<GameTable>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<ClubMembership> Memberships => Set<ClubMembership>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingParticipant> BookingParticipants => Set<BookingParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasKey(u => u.Id);
        modelBuilder.Entity<Club>().HasKey(c => c.Id);
        modelBuilder.Entity<GameTable>().HasKey(t => t.Id);
        modelBuilder.Entity<ClubMembership>().HasKey(m => m.Id);
        modelBuilder.Entity<Booking>().HasKey(b => b.Id);
        modelBuilder.Entity<BookingParticipant>().HasKey(p => p.Id);

        modelBuilder.Entity<GameTable>()
            .HasOne(t => t.Club)
            .WithMany(c => c.Tables)
            .HasForeignKey(t => t.ClubId);

        modelBuilder.Entity<ClubMembership>()
            .HasOne(m => m.User)
            .WithMany(u => u.Memberships)
            .HasForeignKey(m => m.UserId);

        modelBuilder.Entity<ClubMembership>()
            .HasOne(m => m.Club)
            .WithMany(c => c.Memberships)
            .HasForeignKey(m => m.ClubId);

        modelBuilder.Entity<Booking>()
            .HasOne(b => b.Table)
            .WithMany(t => t.Bookings)
            .HasForeignKey(b => b.TableId);

        modelBuilder.Entity<Booking>()
            .HasOne(b => b.User)
            .WithMany(u => u.Bookings)
            .HasForeignKey(b => b.UserId);

        modelBuilder.Entity<BookingParticipant>()
            .HasOne(p => p.Booking)
            .WithMany(b => b.Participants)
            .HasForeignKey(p => p.BookingId);

        modelBuilder.Entity<BookingParticipant>()
            .HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId);
    }
}
