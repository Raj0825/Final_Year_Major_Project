package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Batch;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;

public interface BatchRepository extends MongoRepository<Batch, String> {
    List<Batch> findByStoreId(String storeId);
    List<Batch> findByStateIn(List<Batch.BatchState> states);
    List<Batch> findByStoreIdAndState(String storeId, Batch.BatchState state);
    List<Batch> findByManagerId(String managerId);
    List<Batch> findByStoreIdIn(Collection<String> storeIds);
}
