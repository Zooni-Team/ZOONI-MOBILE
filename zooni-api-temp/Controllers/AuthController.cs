using Microsoft.AspNetCore.Mvc;
using ZooniApi.Services;

namespace ZooniApi.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    // POST /api/v1/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var token = await _authService.LoginAsync(req.Email, req.Password);
        if (token is null) return Unauthorized(new { error = "Credenciales inválidas" });
        return Ok(new { token });
    }
}

public record LoginRequest(string Email, string Password);
