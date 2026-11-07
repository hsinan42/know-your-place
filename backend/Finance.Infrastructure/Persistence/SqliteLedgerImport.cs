using Finance.Application.Accounts;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Finance.Infrastructure.Persistence;

internal static class SqliteLedgerImport
{
    public static async Task ImportAsync(FinanceDbContext target, string path, string ownerHash,
        bool verifyExisting, CancellationToken cancellationToken)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("SQLite aktarım dosyası bulunamadı.", path);
        await using var source = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadOnly,
            Pooling = false
        }.ConnectionString);
        await source.OpenAsync(cancellationToken);
        await using var snapshot = source.BeginTransaction(deferred: true);
        var integrity = await ReadAsync("PRAGMA integrity_check", row => row.GetString(0));
        if (!integrity.SequenceEqual(["ok"])) throw new InvalidOperationException("SQLite bütünlük kontrolü başarısız.");

        var tables = await ReadAsync("SELECT name FROM sqlite_master WHERE type = 'table'", row => row.GetString(0));
        List<UserRow> users;
        List<LedgerRow> ledgers;
        List<SessionRow> sessions = [];
        if (tables.Contains("Ledgers"))
        {
            users = await ReadAsync("SELECT Id, Username, NormalizedUsername, PasswordHash, IsOwner FROM Users", row => new UserRow
            {
                Id = row.GetGuid(0), Username = row.GetString(1), NormalizedUsername = row.GetString(2),
                PasswordHash = row.GetString(3), IsOwner = row.GetBoolean(4)
            });
            ledgers = await ReadAsync("SELECT UserId, Json, Version FROM Ledgers", row => new LedgerRow
            {
                UserId = row.GetGuid(0), Json = row.GetString(1), Version = row.GetInt32(2)
            });
            sessions = await ReadAsync("SELECT Id, UserId, ExpiresAt FROM Sessions", row => new SessionRow
            {
                Id = row.GetGuid(0), UserId = row.GetGuid(1), ExpiresAt = row.GetInt64(2)
            });
        }
        else if (tables.Contains("Documents"))
        {
            var ownerId = verifyExisting
                ? await target.Users.Where(user => user.IsOwner)
                    .Select(user => user.Id).SingleAsync(cancellationToken)
                : Guid.NewGuid();
            users = [new() { Id = ownerId, Username = AccountService.OwnerUsername, NormalizedUsername = "OWNER", PasswordHash = ownerHash, IsOwner = true }];
            ledgers = await ReadAsync("SELECT Json, Version FROM Documents", row => new LedgerRow
            {
                UserId = ownerId, Json = row.GetString(0), Version = row.GetInt32(1)
            });
        }
        else throw new InvalidOperationException("SQLite dosyasında desteklenen finans şeması bulunamadı.");

        if (users.Count(user => user.IsOwner && user.NormalizedUsername == "OWNER") != 1 ||
            !users.Select(user => user.Id).ToHashSet().SetEquals(ledgers.Select(ledger => ledger.UserId)))
            throw new InvalidOperationException("SQLite kullanıcı ve finans kayıtları eşleşmiyor.");

        if (!verifyExisting)
        {
            target.Users.AddRange(users);
            target.Ledgers.AddRange(ledgers);
            target.Sessions.AddRange(sessions);
            await target.SaveChangesAsync(cancellationToken);
        }

        var saved = await target.Ledgers.AsNoTracking().ToDictionaryAsync(item => item.UserId, cancellationToken);
        if (saved.Count != ledgers.Count || ledgers.Any(item =>
                !saved.TryGetValue(item.UserId, out var copy) || copy.Json != item.Json || copy.Version != item.Version))
            throw new InvalidOperationException("PostgreSQL aktarım doğrulaması başarısız.");

        async Task<List<T>> ReadAsync<T>(string sql, Func<SqliteDataReader, T> map)
        {
            await using var command = source.CreateCommand();
            command.Transaction = snapshot;
            command.CommandText = sql;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var result = new List<T>();
            while (await reader.ReadAsync(cancellationToken)) result.Add(map(reader));
            return result;
        }
    }
}
