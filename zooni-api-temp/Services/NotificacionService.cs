using Microsoft.Data.SqlClient;
using ZooniApi.DTOs;

namespace ZooniApi.Services;

public class NotificacionService
{
    private readonly string _connStr;

    public NotificacionService(IConfiguration config)
    {
        _connStr = config.GetConnectionString("DefaultConnection")!;
    }

    public async Task<NotificacionesResponse> GetNotificacionesAsync(
        int userId, int page, int limit, bool soloNoLeidas)
    {
        var offset = (page - 1) * limit;
        var whereLeida = soloNoLeidas ? "AND n.Leido = 0" : "";

        var sql = $"""
            SELECT
                n.Id,
                n.Tipo,
                n.Titulo,
                n.Mensaje   AS Cuerpo,
                n.Leido,
                n.Fecha,
                NULL        AS FotoUrl,
                NULL        AS Redirigea
            FROM Notificacion n
            WHERE n.Id_User = @UserId {whereLeida}
            ORDER BY n.Fecha DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;

            SELECT COUNT(*) FROM Notificacion WHERE Id_User = @UserId AND Leido = 0;
            """;

        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);
        cmd.Parameters.AddWithValue("@Offset", offset);
        cmd.Parameters.AddWithValue("@Limit", limit);

        var notifs = new List<NotificacionDto>();
        int totalNoLeidas = 0;

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            notifs.Add(new NotificacionDto
            {
                Id = reader.GetInt32(0),
                Tipo = reader.IsDBNull(1) ? "" : reader.GetString(1),
                Titulo = reader.IsDBNull(2) ? "" : reader.GetString(2),
                Cuerpo = reader.IsDBNull(3) ? "" : reader.GetString(3),
                Leida = reader.GetBoolean(4),
                CreatedAt = reader.GetDateTime(5),
                FotoUrl = null,
                Redirigea = null,
            });
        }

        if (await reader.NextResultAsync() && await reader.ReadAsync())
            totalNoLeidas = reader.GetInt32(0);

        return new NotificacionesResponse
        {
            Notificaciones = notifs,
            TotalNoLeidas = totalNoLeidas,
        };
    }

    public async Task<bool> MarcarLeidaAsync(int userId, int notifId)
    {
        const string sql = """
            UPDATE Notificacion SET Leido = 1
            WHERE Id = @Id AND Id_User = @UserId
            """;
        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", notifId);
        cmd.Parameters.AddWithValue("@UserId", userId);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<int> MarcarTodasLeidasAsync(int userId)
    {
        const string sql = "UPDATE Notificacion SET Leido = 1 WHERE Id_User = @UserId AND Leido = 0";
        await using var conn = new SqlConnection(_connStr);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@UserId", userId);
        return await cmd.ExecuteNonQueryAsync();
    }
}
