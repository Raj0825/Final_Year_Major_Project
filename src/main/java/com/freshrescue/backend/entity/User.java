package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String name;
    private String email;
    private String passwordHash;

    private Role role;

    // only set when role == STORE_MANAGER or STORE_STAFF
    private String storeId;


    private GeoJsonPoint location;
    private Double notificationRadiusKm;
    private List<String> preferredCategories;

    public enum Role {
        STORE_MANAGER, STORE_STAFF, NGO, CUSTOMER
    }
}
