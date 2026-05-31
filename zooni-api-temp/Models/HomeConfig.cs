namespace ZooniApi.Models;

/// <summary>
/// In-memory representation of a user's Home button configuration.
/// Stored as JSON in the HomeConfig table.
/// </summary>
public class HomeConfig
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public List<BotonConfig> Botones { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class BotonConfig
{
    public string Seccion { get; set; } = string.Empty;
    public int Orden { get; set; }
    public bool Visible { get; set; }
}
