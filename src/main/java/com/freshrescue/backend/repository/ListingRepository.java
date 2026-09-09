package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Listing;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ListingRepository extends MongoRepository<Listing, String> {

    Listing findByBatchId(String batchId);

    List<Listing> findByCategory(String category);

    List<Listing> findByUrgentTrue();

    // Geospatial "near me" queries ($geoNear) are done via MongoTemplate in
    // ListingService, not here - repository-derived $geoNear support is unreliable
    // for aggregation-based sorting alongside other filters (category, tier, etc).
}
