package com.freshrescue.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

@Configuration
@EnableMongoAuditing // powers @CreatedDate / @LastModifiedDate on Batch
public class MongoConfig {
}
