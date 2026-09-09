package com.freshrescue.backend.service;

import com.freshrescue.backend.dto.MlPredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.ByteArrayInputStream;
import java.util.Optional;

/**
 * Thin client around the Python ML microservice (FastAPI, running the CNN freshness
 * model + OCR). Spring Boot is the only thing that talks to it directly - React never
 * calls it, see BatchController#scanBatch.
 *
 * While the CNN is still being trained (see /areas note on dataset sourcing), point
 * ml.service.base-url at a stub FastAPI app that returns randomized/fixed values in the
 * same JSON shape, so backend + frontend work isn't blocked.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlPredictionService {

    private final WebClient mlServiceWebClient;

    @Value("${ml.service.predict-path}")
    private String predictPath;

    /** Empty when the ML call failed - caller must NOT guess a score in that case, see BatchService#scanBatch. */
    public Optional<MlPredictionResponse> predict(byte[] imageBytes, String filename) {
        MultipartBodyBuilder bodyBuilder = new MultipartBodyBuilder();
        bodyBuilder.part("image", new ByteArrayInputStream(imageBytes))
                .filename(filename)
                .contentType(MediaType.IMAGE_JPEG);

        try {
            MlPredictionResponse response = mlServiceWebClient.post()
                    .uri(predictPath)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .bodyValue(bodyBuilder.build())
                    .retrieve()
                    .bodyToMono(MlPredictionResponse.class)
                    .block(); // simple synchronous call is fine here - the scan endpoint
            // is already a user-initiated, latency-tolerant action
            return Optional.ofNullable(response);
        } catch (Exception e) {
            log.error("ML service call failed - flagging batch for manual review instead of guessing a score", e);
            // Fail-safe: if the ML service is down, don't block staff from recording a scan,
            // but don't fabricate a freshness score either - a wrong guess here can silently
            // discount (or fail to discount) real inventory. BatchService flags the batch as
            // needsManualReview and leaves its state/discount untouched.
            return Optional.empty();
        }
    }
}