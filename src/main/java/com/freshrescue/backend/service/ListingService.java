package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Listing;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.NearQuery;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ListingService {

    private final ListingRepository listingRepository;
    private final BatchRepository batchRepository;
    private final StoreRepository storeRepository;
    private final MongoTemplate mongoTemplate;

    /**
     * Keeps the buyer-facing Listing in sync with its parent Batch's state.
     * All batches with available quantity > 0 and not EXPIRED are listed.
     */
    public void syncListingForBatch(Batch batch) {
        if (batch == null || batch.getId() == null) return;

        double available = batch.getQuantity() - batch.getQuantityReserved();
        Listing existing = listingRepository.findByBatchId(batch.getId());

        if (batch.getState() == Batch.BatchState.EXPIRED || available <= 0) {
            if (existing != null) {
                listingRepository.delete(existing);
            }
            return;
        }

        // Determine discount based on state or explicit discount
        int discountPercent = 0;
        if (batch.getCurrentDiscountPercent() != null && batch.getCurrentDiscountPercent() > 0) {
            discountPercent = batch.getCurrentDiscountPercent();
        } else if (batch.getState() == Batch.BatchState.TIER_1) {
            discountPercent = 20;
        } else if (batch.getState() == Batch.BatchState.TIER_2) {
            discountPercent = 40;
        } else if (batch.getState() == Batch.BatchState.TIER_3) {
            discountPercent = 60;
        }

        // Resolve store name and location
        String storeName = "Store " + (batch.getStoreId() != null ? batch.getStoreId().substring(Math.max(0, batch.getStoreId().length() - 6)) : "");
        GeoJsonPoint storeLocation = null;

        if (batch.getStoreId() != null) {
            Store store = storeRepository.findById(batch.getStoreId()).orElse(null);
            if (store != null) {
                if (store.getName() != null && !store.getName().isBlank()) {
                    storeName = store.getName();
                }
                storeLocation = store.getLocation();
            }
        }

        Listing listing = existing != null ? existing : Listing.builder()
                .batchId(batch.getId())
                .storeId(batch.getStoreId())
                .productName(batch.getProductName())
                .category(batch.getCategory())
                .unit(batch.getUnit())
                .listedAt(Instant.now())
                .build();

        listing.setStoreName(storeName);
        if (storeLocation != null) {
            listing.setStoreLocation(storeLocation);
        }
        if (batch.getImageUrls() != null && !batch.getImageUrls().isEmpty()) {
            listing.setImageUrl(batch.getImageUrls().get(0));
        }

        listing.setDiscountPercent(discountPercent);
        listing.setQuantityAvailable(available);
        listing.setTier(batch.getState());
        listing.setUrgent(batch.getState() == Batch.BatchState.TIER_3);
        listing.setUpdatedAt(Instant.now());

        double original = batch.getOriginalPrice() > 0 ? batch.getOriginalPrice() : 50.0;
        listing.setOriginalPrice(original);
        listing.setCurrentPrice(Math.round(original * (1 - discountPercent / 100.0) * 100.0) / 100.0);

        listingRepository.save(listing);
    }

    /**
     * Buyer App feed: listings within radiusKm of the buyer's location, closest first.
     * Falls back cleanly if 2dsphere index is absent or no listings match distance.
     */
    public List<Listing> findNearby(double longitude, double latitude, double radiusKm) {
        try {
            NearQuery nearQuery = NearQuery.near(new GeoJsonPoint(longitude, latitude))
                    .maxDistance(radiusKm, org.springframework.data.geo.Metrics.KILOMETERS)
                    .spherical(true);

            GeoResults<Listing> results = mongoTemplate.query(Listing.class)
                    .near(nearQuery)
                    .all();

            List<Listing> nearby = results.getContent().stream()
                    .map(org.springframework.data.geo.GeoResult::getContent)
                    .toList();

            if (!nearby.isEmpty()) {
                return nearby;
            }
        } catch (Exception e) {
            log.warn("GeoNear query error, falling back to all active listings: {}", e.getMessage());
        }
        // Fallback so the customer feed never shows an error
        return listingRepository.findAll();
    }

    public List<Listing> findUrgent() {
        List<Listing> urgent = listingRepository.findByUrgentTrue();
        if (urgent.isEmpty()) {
            // If no urgent tier 3 items, return all listings so buyer still sees deals
            return listingRepository.findAll();
        }
        return urgent;
    }

    public List<Listing> findAll() {
        return listingRepository.findAll();
    }

    /**
     * Automatically sync all active batches in MongoDB to listings on startup
     * so newly added or existing items immediately appear for buyers.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void syncAllBatchesOnStartup() {
        try {
            List<Batch> allBatches = batchRepository.findAll();
            for (Batch b : allBatches) {
                syncListingForBatch(b);
            }
            log.info("Synced {} batches to listings collection on startup", allBatches.size());
        } catch (Exception e) {
            log.error("Failed to sync batches to listings on startup: {}", e.getMessage());
        }
    }
}