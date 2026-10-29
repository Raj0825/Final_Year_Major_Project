package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Order;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.ListingRepository;
import com.freshrescue.backend.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private BatchRepository batchRepository;

    @Mock
    private ListingService listingService;

    @Mock
    private MongoTemplate mongoTemplate;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(
                orderRepository,
                listingRepository,
                batchRepository,
                listingService,
                mongoTemplate
        );
    }

    @Test
    @DisplayName("reserve: should reject quantity <= 0")
    void testReserveRejectsNegativeOrZeroQuantity() {
        assertThrows(IllegalArgumentException.class, () ->
                orderService.reserve("listing-1", "user-1", Order.BuyerType.CUSTOMER, 0.0));

        assertThrows(IllegalArgumentException.class, () ->
                orderService.reserve("listing-1", "user-1", Order.BuyerType.CUSTOMER, -5.0));
    }

    @Test
    @DisplayName("reserve: should reject NaN quantity")
    void testReserveRejectsNaN() {
        assertThrows(IllegalArgumentException.class, () ->
                orderService.reserve("listing-1", "user-1", Order.BuyerType.CUSTOMER, Double.NaN));
    }

    @Test
    @DisplayName("reserve: should reject Infinite quantity")
    void testReserveRejectsInfinity() {
        assertThrows(IllegalArgumentException.class, () ->
                orderService.reserve("listing-1", "user-1", Order.BuyerType.CUSTOMER, Double.POSITIVE_INFINITY));

        assertThrows(IllegalArgumentException.class, () ->
                orderService.reserve("listing-1", "user-1", Order.BuyerType.CUSTOMER, Double.NEGATIVE_INFINITY));
    }
}

