package com.freshrescue.backend.dto;

/**
 * Maps to the JSON returned by the Python FastAPI /predict endpoint:
 * { "freshnessScore": 0.82, "predictedDaysToExpiry": 4, "ocrExtractedDate": "12/09" }
 */
public record MlPredictionResponse(
        Double freshnessScore,
        Integer predictedDaysToExpiry,
        String ocrExtractedDate
) {}
