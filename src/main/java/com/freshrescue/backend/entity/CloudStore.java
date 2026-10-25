package com.freshrescue.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "registered_stores")
public class CloudStore {
    @Id
    private String id;
    private String name;
    private String location;
    private String area;
    private String city;
    private String phone;
    private String managerName;
    private String joinedAt;
}
