package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Listing;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ListingRepository extends MongoRepository<Listing, String> {

    Listing findByBatchId(String batchId);

    List<Listing> findByStoreId(String storeId);

    List<Listing> findByCategory(String category);

    List<Listing> findByUrgentTrue();


}
