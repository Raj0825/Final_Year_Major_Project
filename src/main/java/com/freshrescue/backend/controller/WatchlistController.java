package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Watch;
import com.freshrescue.backend.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/watchlist")
@RequiredArgsConstructor
public class WatchlistController {

    private final WatchlistService watchlistService;

    public record CreateWatchRequest(
            String keyword,
            String category,
            Double maxPrice,
            Double radiusKm
    ) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public ResponseEntity<Watch> createWatch(@RequestBody CreateWatchRequest req, Authentication auth) {
        String userId = auth.getName();
        Watch created = watchlistService.createWatch(
                userId,
                req.keyword(),
                req.category(),
                req.maxPrice(),
                req.radiusKm()
        );
        return ResponseEntity.ok(created);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public List<Watch> getMyWatches(Authentication auth) {
        String userId = auth.getName();
        return watchlistService.getWatchesForUser(userId);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('NGO', 'CUSTOMER')")
    public ResponseEntity<Void> deleteWatch(@PathVariable String id, Authentication auth) {
        String userId = auth.getName();
        watchlistService.deleteWatchForUser(id, userId);
        return ResponseEntity.noContent().build();
    }
}

