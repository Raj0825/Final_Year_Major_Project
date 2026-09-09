package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Store;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface StoreRepository extends MongoRepository<Store, String> {
    List<Store> findByManagerId(String managerId);
}
