package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Notification;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.entity.Watch;
import com.freshrescue.backend.repository.NotificationRepository;
import com.freshrescue.backend.repository.UserRepository;
import com.freshrescue.backend.repository.WatchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WatchlistServiceTest {

    @Mock
    private WatchRepository watchRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationRepository notificationRepository;

    private WatchlistService watchlistService;

    @BeforeEach
    void setUp() {
        watchlistService = new WatchlistService(watchRepository, userRepository, notificationRepository);
    }

    @Test
    @DisplayName("Watch matching: keyword, category, maxPrice, radius, and 24h de-duplication")
    void testWatchMatchingFullCriteria() {
        String userId = "buyer-123";
        String itemId = "item-999";

        // Store location (Solapur center ~ 75.9064, 17.6599)
        GeoJsonPoint storeLocation = new GeoJsonPoint(75.9064, 17.6599);

        // User within 3km of store
        User userNear = User.builder()
                .id(userId)
                .name("Test Buyer")
                .location(new GeoJsonPoint(75.9100, 17.6650)) // ~0.7 km away
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(userNear));

        // Watch matches keyword "tomato", category "Vegetables", maxPrice 50.0, radius 5.0
        Watch matchingWatch = Watch.builder()
                .id("watch-1")
                .userId(userId)
                .keyword("tomato")
                .category("Vegetables")
                .maxPrice(50.0)
                .radiusKm(5.0)
                .build();

        when(watchRepository.findPotentialMatchingWatches(eq("Vegetables"), eq(30.0)))
                .thenReturn(List.of(matchingWatch));

        // Not previously notified in the last 24h
        when(notificationRepository.existsByUserIdAndListingIdAndTypeAndCreatedAtAfter(
                eq(userId), eq(itemId), eq(Notification.NotificationType.WATCHLIST), any(Instant.class)))
                .thenReturn(false);

        // Trigger item update: "Organic Fresh Tomatoes", Vegetables, 30 Rs, 40% off
        watchlistService.checkItemAgainstWatches(
                itemId,
                "Organic Fresh Tomatoes",
                "Vegetables",
                30.0,
                40,
                "Rajesh Patel Store",
                storeLocation
        );

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(1)).save(captor.capture());

        Notification saved = captor.getValue();
        assertEquals(userId, saved.getUserId());
        assertEquals(itemId, saved.getListingId());
        assertEquals(Notification.NotificationType.WATCHLIST, saved.getType());
        assertTrue(saved.getMessage().contains("Organic Fresh Tomatoes is now 40% off at Rajesh Patel Store"));
    }

    @Test
    @DisplayName("Watch matching: skips notification if already notified within 24 hours")
    void testWatchMatchingSkipsIfAlreadyNotified24h() {
        String userId = "buyer-123";
        String itemId = "item-999";

        Watch watch = Watch.builder()
                .id("watch-1")
                .userId(userId)
                .keyword("tomato")
                .build();

        when(watchRepository.findPotentialMatchingWatches(anyString(), anyDouble()))
                .thenReturn(List.of(watch));
        when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().id(userId).build()));

        // Already notified in last 24h
        when(notificationRepository.existsByUserIdAndListingIdAndTypeAndCreatedAtAfter(
                eq(userId), eq(itemId), eq(Notification.NotificationType.WATCHLIST), any(Instant.class)))
                .thenReturn(true);

        watchlistService.checkItemAgainstWatches(
                itemId,
                "Tomatoes",
                "Vegetables",
                25.0,
                20,
                "Store A",
                null
        );

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("Watch matching: skips if store is outside watch radius")
    void testWatchMatchingSkipsIfOutsideRadius() {
        String userId = "buyer-123";
        String itemId = "item-999";

        // Store in Solapur (75.9064, 17.6599)
        GeoJsonPoint storeLoc = new GeoJsonPoint(75.9064, 17.6599);
        // User in Pune (73.8567, 18.5204) ~ 230 km away
        User userFar = User.builder()
                .id(userId)
                .location(new GeoJsonPoint(73.8567, 18.5204))
                .build();

        Watch watch = Watch.builder()
                .id("watch-1")
                .userId(userId)
                .keyword("spinach")
                .radiusKm(10.0) // only 10 km
                .build();

        when(watchRepository.findPotentialMatchingWatches(anyString(), anyDouble()))
                .thenReturn(List.of(watch));
        when(userRepository.findById(userId)).thenReturn(Optional.of(userFar));

        watchlistService.checkItemAgainstWatches(
                itemId,
                "Fresh Spinach",
                "Vegetables",
                15.0,
                30,
                "Solapur Store",
                storeLoc
        );

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("User ownership: a user cannot delete another user's watch")
    void testUserCannotDeleteAnotherUsersWatch() {
        String ownerUserId = "owner-1";
        String attackerUserId = "attacker-2";
        String watchId = "watch-abc";

        Watch watch = Watch.builder()
                .id(watchId)
                .userId(ownerUserId)
                .keyword("apples")
                .build();

        when(watchRepository.findById(watchId)).thenReturn(Optional.of(watch));

        // Attacker attempts to delete owner's watch -> AccessDeniedException
        assertThrows(AccessDeniedException.class, () ->
                watchlistService.deleteWatchForUser(watchId, attackerUserId));

        verify(watchRepository, never()).deleteById(anyString());
    }

    @Test
    @DisplayName("User ownership: a user can only read their own watches")
    void testUserCanOnlyReadOwnWatches() {
        String userId = "user-1";
        Watch watch = Watch.builder().id("w-1").userId(userId).keyword("mango").build();

        when(watchRepository.findByUserId(userId)).thenReturn(List.of(watch));

        List<Watch> results = watchlistService.getWatchesForUser(userId);
        assertEquals(1, results.size());
        assertEquals("mango", results.get(0).getKeyword());
        verify(watchRepository).findByUserId(userId);
    }
}

