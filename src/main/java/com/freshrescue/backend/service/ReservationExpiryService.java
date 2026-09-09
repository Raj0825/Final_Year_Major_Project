package com.freshrescue.backend.service;

import com.freshrescue.backend.entity.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReservationExpiryService {

    private final OrderService orderService;

    // Runs every minute - hold windows are short (default 15 min), so this needs to
    // be fairly frequent to keep the buyer-facing feed's stock counts accurate.
    @Scheduled(fixedRate = 60_000)
    public void releaseExpiredHolds() {
        List<Order> expired = orderService.findExpiredHolds(Instant.now());
        if (expired.isEmpty()) return;

        log.info("Releasing {} expired reservation(s)", expired.size());
        expired.forEach(orderService::expireReservation);
    }
}
