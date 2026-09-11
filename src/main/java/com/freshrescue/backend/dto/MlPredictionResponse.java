package com.freshrescue.backend.dto;


public record MlPredictionResponse(
        Double freshnessScore,
        Integer predictedDaysToExpiry,
        String ocrExtractedDate
) {}
