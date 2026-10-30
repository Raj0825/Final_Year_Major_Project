package com.freshrescue.backend.service;

import com.freshrescue.backend.dto.MlPredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Optional;


@Slf4j
@Service
@RequiredArgsConstructor
public class MlPredictionService {

    private final WebClient mlServiceWebClient;

    @Value("${ml.service.predict-path}")
    private String predictPath;

    /** Empty when the ML call failed - caller must NOT guess a score in that case, see BatchService#scanBatch. */
    public Optional<MlPredictionResponse> predict(byte[] imageBytes, String filename) {
        org.springframework.core.io.ByteArrayResource imageResource = new org.springframework.core.io.ByteArrayResource(imageBytes) {
            @Override
            public String getFilename() {
                return filename != null && !filename.isBlank() ? filename : "image.jpg";
            }
        };

        MultipartBodyBuilder bodyBuilder = new MultipartBodyBuilder();
        bodyBuilder.part("image", imageResource)
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

            return Optional.empty();
        }
    }
}