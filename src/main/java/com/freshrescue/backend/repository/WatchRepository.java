package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Watch;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchRepository extends MongoRepository<Watch, String> {

    List<Watch> findByUserId(String userId);

    Optional<Watch> findByIdAndUserId(String id, String userId);

    void deleteByIdAndUserId(String id, String userId);

    long countByUserId(String userId);

    @Query("{ '$and': [ " +
            "  { '$or': [ { 'category': null }, { 'category': '' }, { 'category': { '$regex': ?0, '$options': 'i' } } ] }, " +
            "  { '$or': [ { 'maxPrice': null }, { 'maxPrice': { '$gte': ?1 } } ] } " +
            "] }")
    List<Watch> findPotentialMatchingWatches(String category, double price);
}

