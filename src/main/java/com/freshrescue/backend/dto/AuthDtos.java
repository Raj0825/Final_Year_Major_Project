package com.freshrescue.backend.dto;

import com.freshrescue.backend.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record SignupRequest(
            @NotBlank String name,
            @Email @NotBlank String email,
            @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
            @NotNull(message = "Role is required") User.Role role,
            String storeId, // for existing store
            String storeName, // for registering new store during signup
            String storeAddress,
            String storePhone,
            Double latitude,
            Double longitude
    ) {}

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {}

    public record AuthResponse(
            String token,
            String userId,
            String name,
            User.Role role,
            String storeId
    ) {}
}
