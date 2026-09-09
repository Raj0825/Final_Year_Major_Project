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
            String storeId // required if role is STORE_MANAGER / STORE_STAFF
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
            String storeId  // null for NGO/CUSTOMER roles
    ) {}
}
