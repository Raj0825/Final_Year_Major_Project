package com.freshrescue.backend.repository;

import com.freshrescue.backend.entity.Order;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByBuyerId(String buyerId);
    List<Order> findByStoreId(String storeId);
    List<Order> findByStatusAndHoldExpiresAtBefore(Order.OrderStatus status, Instant instant);
}
