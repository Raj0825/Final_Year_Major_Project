package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "watches")
public class Watch {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String keyword;
    private String category;
    private Double maxPrice;

    @Builder.Default
    private double radiusKm = 5.0;

    private Instant createdAt;
}

