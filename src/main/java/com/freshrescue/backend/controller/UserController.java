package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    public record UserProfileResponse(
            String id,
            String name,
            String email,
            User.Role role,
            String storeId,
            Double notificationRadiusKm,
            List<String> preferredCategories,
            Double latitude,
            Double longitude
    ) {}

    public record UpdateProfileRequest(
            String name,
            Double notificationRadiusKm,
            List<String> preferredCategories,
            Double latitude,
            Double longitude,
            String storeId
    ) {}

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(Authentication auth) {
        String userId = auth.getName();
        return userRepository.findById(userId)
                .map(this::toResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @RequestBody UpdateProfileRequest req,
            Authentication auth
    ) {
        String userId = auth.getName();
        return userRepository.findById(userId)
                .map(user -> {
                    if (req.name() != null && !req.name().isBlank()) {
                        user.setName(req.name().trim());
                    }
                    if (req.notificationRadiusKm() != null) {
                        user.setNotificationRadiusKm(req.notificationRadiusKm());
                    }
                    if (req.preferredCategories() != null) {
                        user.setPreferredCategories(req.preferredCategories());
                    }
                    if (req.latitude() != null && req.longitude() != null) {
                        user.setLocation(new GeoJsonPoint(req.longitude(), req.latitude()));
                    }
                    if (req.storeId() != null && !req.storeId().isBlank() &&
                            (user.getRole() == User.Role.STORE_MANAGER || user.getRole() == User.Role.STORE_STAFF)) {
                        user.setStoreId(req.storeId().trim());
                    }
                    User saved = userRepository.save(user);
                    return ResponseEntity.ok(toResponse(saved));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private UserProfileResponse toResponse(User u) {
        Double lat = (u.getLocation() != null) ? u.getLocation().getY() : null;
        Double lng = (u.getLocation() != null) ? u.getLocation().getX() : null;
        return new UserProfileResponse(
                u.getId(),
                u.getName(),
                u.getEmail(),
                u.getRole(),
                u.getStoreId(),
                u.getNotificationRadiusKm(),
                u.getPreferredCategories(),
                lat,
                lng
        );
    }
}
