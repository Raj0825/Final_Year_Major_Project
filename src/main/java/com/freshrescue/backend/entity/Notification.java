package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    private String userId;
    private String listingId;
    private NotificationType type;
    private String message;

    @Builder.Default
    private boolean read = false;

    private Instant createdAt;

    public enum NotificationType {
        NEW_DISCOUNT, PRICE_DROP, URGENT, ORDER_CONFIRMED, PICKUP_REMINDER
    }
}
