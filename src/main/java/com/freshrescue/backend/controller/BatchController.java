package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.service.BatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;
    private final BatchRepository batchRepository;

    /** Store staff/managers may only ever act on their own store's data. */
    private void checkOwnStore(Authentication auth, String storeId) {
        String staffStoreId = (String) auth.getDetails();
        if (staffStoreId == null || !staffStoreId.equals(storeId)) {
            throw new AccessDeniedException("You do not have access to store " + storeId);
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch createBatch(@RequestBody Batch batch, Authentication auth) {
        checkOwnStore(auth, batch.getStoreId());
        return batchService.createBatch(batch);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch getBatch(@PathVariable String id, Authentication auth) {
        Batch batch = batchService.getBatch(id);
        checkOwnStore(auth, batch.getStoreId());
        return batch;
    }

    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getBatchesForStore(@PathVariable String storeId, Authentication auth) {
        checkOwnStore(auth, storeId);
        return batchRepository.findByStoreId(storeId);
    }

    /**
     * The core "scan" action from the dashboard mockup - staff upload a new photo of
     * a batch, which triggers the ML call -> state transition -> listing sync pipeline
     * (see BatchService#scanBatch). React only ever calls this endpoint; it never talks
     * to the Python ML service directly.
     */
    @PostMapping(value = "/{id}/scan", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch scanBatch(@PathVariable String id, @RequestParam("image") MultipartFile image,
                           Authentication auth) throws IOException {
        Batch batch = batchService.getBatch(id);
        checkOwnStore(auth, batch.getStoreId());
        return batchService.scanBatch(id, image.getBytes(), image.getOriginalFilename());
    }
}