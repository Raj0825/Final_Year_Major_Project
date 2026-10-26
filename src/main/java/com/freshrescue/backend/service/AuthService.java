package com.freshrescue.backend.service;

import com.freshrescue.backend.dto.AuthDtos.AuthResponse;
import com.freshrescue.backend.dto.AuthDtos.LoginRequest;
import com.freshrescue.backend.dto.AuthDtos.SignupRequest;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse signup(SignupRequest req) {
        String cleanEmail = req.email() != null ? req.email().trim().toLowerCase() : "";
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new IllegalArgumentException("Email already registered: " + cleanEmail);
        }

        if (req.storeId() != null && !req.storeId().isBlank()) {
            throw new IllegalArgumentException("Choosing a storeId during registration is not permitted");
        }

        if (req.role() == User.Role.STORE_STAFF) {
            throw new IllegalArgumentException("STORE_STAFF cannot be registered via public signup");
        }

        User user = User.builder()
                .name(req.name())
                .email(cleanEmail)
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(req.role())
                .build();

        User saved = userRepository.save(user);

        // If STORE_MANAGER, automatically create and link the Store upfront
        if (req.role() == User.Role.STORE_MANAGER) {
            String storeName = (req.storeName() != null && !req.storeName().isBlank())
                    ? req.storeName().trim()
                    : req.name() + " Store";

            GeoJsonPoint loc = (req.latitude() != null && req.longitude() != null)
                    ? new GeoJsonPoint(req.longitude(), req.latitude())
                    : null;

            Store store = Store.builder()
                    .name(storeName)
                    .managerId(saved.getId())
                    .address(req.storeAddress() != null ? req.storeAddress().trim() : "")
                    .phone(req.storePhone() != null ? req.storePhone().trim() : "")
                    .location(loc)
                    .averageRating(0.0)
                    .reviewCount(0)
                    .createdAt(Instant.now())
                    .build();

            Store savedStore = storeRepository.save(store);
            saved.setStoreId(savedStore.getId());
            saved = userRepository.save(saved);
        }

        String token = jwtService.generateToken(saved.getId(), saved.getRole().name(), saved.getStoreId());
        return new AuthResponse(token, saved.getId(), saved.getName(), saved.getRole(), saved.getStoreId());
    }

    public AuthResponse login(LoginRequest req) {
        String cleanEmail = req.email() != null ? req.email().trim().toLowerCase() : "";
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        // If user is STORE_MANAGER but has no storeId in DB, check StoreRepository
        if (user.getRole() == User.Role.STORE_MANAGER && (user.getStoreId() == null || user.getStoreId().isBlank())) {
            var stores = storeRepository.findByManagerId(user.getId());
            if (!stores.isEmpty()) {
                user.setStoreId(stores.get(0).getId());
                user = userRepository.save(user);
            }
        }

        String token = jwtService.generateToken(user.getId(), user.getRole().name(), user.getStoreId());
        return new AuthResponse(token, user.getId(), user.getName(), user.getRole(), user.getStoreId());
    }
}