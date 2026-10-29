package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.CloudOrder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CloudOrderRepository extends MongoRepository<CloudOrder, String> {
    List<CloudOrder> findByStoreNameIgnoreCase(String storeName);
    List<CloudOrder> findByCustomerNameIgnoreCase(String customerName);
    List<CloudOrder> findByCustomerEmailIgnoreCase(String customerEmail);
    List<CloudOrder> findByStoreId(String storeId);
    List<CloudOrder> findByStoreIdIn(Collection<String> storeIds);
    Optional<CloudOrder> findByQrCode(String qrCode);
}
