package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.CloudOrder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CloudOrderRepository extends MongoRepository<CloudOrder, String> {
    List<CloudOrder> findByStoreNameIgnoreCase(String storeName);
    List<CloudOrder> findByCustomerNameIgnoreCase(String customerName);
}
