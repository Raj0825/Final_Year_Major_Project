package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.service.ListingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Buyer App feed - public, no auth required to browse (see SecurityConfig). */
@RestController
@RequestMapping("/api/listings")
@RequiredArgsConstructor
public class ListingController {

    private final ListingService listingService;

    @GetMapping("/nearby")
    public List<Listing> nearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5") double radiusKm
    ) {
        return listingService.findNearby(lng, lat, radiusKm);
    }

    @GetMapping("/urgent")
    public List<Listing> urgent() {
        return listingService.findUrgent();
    }
}
