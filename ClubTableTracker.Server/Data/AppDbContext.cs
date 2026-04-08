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
    public DbSet<BookingLog> BookingLogs => Set<BookingLog>();
    public DbSet<ClubEvent> ClubEvents => Set<ClubEvent>();
    public DbSet<EventParticipant> EventParticipants => Set<EventParticipant>();
    public DbSet<ClubDecoration> ClubDecorations => Set<ClubDecoration>();
    public DbSet<ClubPhoto> ClubPhotos => Set<ClubPhoto>();

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
            .HasForeignKey(m => m.UserId)
            .IsRequired(false);

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
            .HasForeignKey(p => p.UserId)
            .IsRequired(false);

        modelBuilder.Entity<BookingParticipant>()
            .HasOne(p => p.ManualMembership)
            .WithMany()
            .HasForeignKey(p => p.ManualMembershipId)
            .IsRequired(false);

        modelBuilder.Entity<BookingLog>().HasKey(l => l.Id);
        modelBuilder.Entity<BookingLog>()
            .HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ClubEvent>().HasKey(e => e.Id);
        modelBuilder.Entity<ClubEvent>()
            .HasOne(e => e.Club)
            .WithMany()
            .HasForeignKey(e => e.ClubId);

        modelBuilder.Entity<EventParticipant>().HasKey(p => p.Id);
        modelBuilder.Entity<EventParticipant>()
            .HasOne(p => p.Event)
            .WithMany(e => e.Participants)
            .HasForeignKey(p => p.EventId);

        modelBuilder.Entity<EventParticipant>()
            .HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId);

        modelBuilder.Entity<ClubDecoration>().HasKey(d => d.Id);
        modelBuilder.Entity<ClubDecoration>()
            .HasOne(d => d.Club)
            .WithMany()
            .HasForeignKey(d => d.ClubId);

        modelBuilder.Entity<ClubPhoto>().HasKey(p => p.Id);
        modelBuilder.Entity<ClubPhoto>()
            .HasOne(p => p.Club)
            .WithMany()
            .HasForeignKey(p => p.ClubId);
    }
}
