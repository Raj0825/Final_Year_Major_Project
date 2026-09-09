package com.freshrescue.backend.service;

import com.freshrescue.backend.dto.AuthDtos.AuthResponse;
import com.freshrescue.backend.dto.AuthDtos.LoginRequest;
import com.freshrescue.backend.dto.AuthDtos.SignupRequest;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    private static final java.util.Set<User.Role> STORE_ROLES =
            java.util.Set.of(User.Role.STORE_MANAGER, User.Role.STORE_STAFF);

    public AuthResponse signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Email already registered: " + req.email());
        }
        if (STORE_ROLES.contains(req.role()) && (req.storeId() == null || req.storeId().isBlank())) {
            throw new IllegalArgumentException("storeId is required for role " + req.role());
        }

        User user = User.builder()
                .name(req.name())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(req.role())
                .storeId(req.storeId())
                .build();

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getId(), saved.getRole().name(), saved.getStoreId());
        return new AuthResponse(token, saved.getId(), saved.getName(), saved.getRole(), saved.getStoreId());
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getRole().name(), user.getStoreId());
        return new AuthResponse(token, user.getId(), user.getName(), user.getRole(), user.getStoreId());
    }
}