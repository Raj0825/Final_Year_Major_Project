package com.freshrescue.backend.dto;

import com.freshrescue.backend.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {

    public record SignupRequest(
            @NotBlank String name,
            @Email @NotBlank String email,
            @NotBlank String password,
            User.Role role,
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
