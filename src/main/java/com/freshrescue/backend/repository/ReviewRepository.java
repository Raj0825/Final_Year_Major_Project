package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Review;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ReviewRepository extends MongoRepository<Review, String> {
    List<Review> findByStoreIdOrderByCreatedAtDesc(String storeId);
    List<Review> findByStoreId(String storeId);
}
