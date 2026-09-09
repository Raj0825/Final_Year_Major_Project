package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.repository.ListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.NearQuery;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ListingService {

    private final ListingRepository listingRepository;
    private final MongoTemplate mongoTemplate; // used for the $geoNear "near me" feed query

    /**
     * Keeps the buyer-facing Listing in sync with its parent Batch's state.
     * FRESH  -> no listing should exist (removed if present, e.g. batch improved somehow)
     * TIER_* -> listing created/updated with current discount + urgency
     * EXPIRED -> listing removed from the feed
     */
    public void syncListingForBatch(Batch batch) {
        Listing existing = listingRepository.findByBatchId(batch.getId());

        if (batch.getState() == Batch.BatchState.FRESH || batch.getState() == Batch.BatchState.EXPIRED) {
            if (existing != null) {
                listingRepository.delete(existing);
            }
            return;
        }

        Listing listing = existing != null ? existing : Listing.builder()
                .batchId(batch.getId())
                .storeId(batch.getStoreId())
                .productName(batch.getProductName())
                .category(batch.getCategory())
                .unit(batch.getUnit())
                .listedAt(Instant.now())
                .build();

        listing.setDiscountPercent(batch.getCurrentDiscountPercent());
        listing.setQuantityAvailable(batch.getQuantity() - batch.getQuantityReserved());
        listing.setTier(batch.getState());
        listing.setUrgent(batch.getState() == Batch.BatchState.TIER_3);
        listing.setUpdatedAt(Instant.now());

        int discountPercent = batch.getCurrentDiscountPercent() != null ? batch.getCurrentDiscountPercent() : 0;
        listing.setOriginalPrice(batch.getOriginalPrice());
        listing.setCurrentPrice(batch.getOriginalPrice() * (1 - discountPercent / 100.0));

        listingRepository.save(listing);
    }

    /** Buyer App feed: listings within radiusKm of the buyer's location, closest first. */
    public List<Listing> findNearby(double longitude, double latitude, double radiusKm) {
        NearQuery nearQuery = NearQuery.near(new GeoJsonPoint(longitude, latitude))
                .maxDistance(radiusKm, org.springframework.data.geo.Metrics.KILOMETERS)
                .spherical(true);

        GeoResults<Listing> results = mongoTemplate.query(Listing.class)
                .near(nearQuery)
                .all();

        return results.getContent().stream()
                .map(org.springframework.data.geo.GeoResult::getContent)
                .toList();
    }

    public List<Listing> findUrgent() {
        return listingRepository.findByUrgentTrue();
    }
}