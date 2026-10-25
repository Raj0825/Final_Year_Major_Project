package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.CloudStore;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CloudStoreRepository extends MongoRepository<CloudStore, String> {
}
