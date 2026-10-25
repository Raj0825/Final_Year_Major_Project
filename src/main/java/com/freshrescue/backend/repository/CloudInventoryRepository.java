package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.CloudInventoryItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CloudInventoryRepository extends MongoRepository<CloudInventoryItem, String> {
    List<CloudInventoryItem> findByStoreId(String storeId);
    List<CloudInventoryItem> findByStoreCityIgnoreCase(String city);
}
