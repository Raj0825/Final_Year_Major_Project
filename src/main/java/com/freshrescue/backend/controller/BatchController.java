package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Batch;
import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.BatchRepository;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    /**
     * Resolves the caller's store reliably:
     * 1) Checks the JWT claim (details).
     * 2) Checks the User profile in MongoDB.
     * 3) Checks stores owned by this manager in StoreRepository.
     * 4) If the manager supplied a storeId, binds it to their profile.
     */
    private String resolveAndVerifyStore(Authentication auth, String requestStoreId) {
        String userId = auth.getName();
        String staffStoreId = (String) auth.getDetails();

        // 1. JWT claim
        if (staffStoreId != null && !staffStoreId.isBlank()) {
            if (requestStoreId == null || requestStoreId.isBlank() || staffStoreId.equalsIgnoreCase(requestStoreId.trim())) {
                return staffStoreId;
            }
        }

        // 2. User entity from DB
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
            String dbStoreId = user.getStoreId();
            if (requestStoreId == null || requestStoreId.isBlank() || dbStoreId.equalsIgnoreCase(requestStoreId.trim())) {
                return dbStoreId;
            }
        }

        // 3. Store managed by this user
        List<Store> stores = storeRepository.findByManagerId(userId);
        if (!stores.isEmpty()) {
            if (requestStoreId == null || requestStoreId.isBlank()) {
                return stores.get(0).getId();
            }
            for (Store s : stores) {
                if (s.getId().equalsIgnoreCase(requestStoreId.trim()) || s.getName().equalsIgnoreCase(requestStoreId.trim())) {
                    return s.getId();
                }
            }
            return stores.get(0).getId();
        }

        // 4. If requestStoreId is provided, bind to user
        if (requestStoreId != null && !requestStoreId.isBlank()) {
            String cleanId = requestStoreId.trim();
            if (user != null) {
                user.setStoreId(cleanId);
                userRepository.save(user);
            }
            return cleanId;
        }

        // 5. Default fallback store ID for managers
        if (user != null) {
            String defaultStoreId = "store_" + userId.substring(Math.max(0, userId.length() - 4));
            user.setStoreId(defaultStoreId);
            userRepository.save(user);
            return defaultStoreId;
        }

        throw new AccessDeniedException("No store associated with your account.");
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch createBatch(@RequestBody Batch batch, Authentication auth) {
        String verifiedStoreId = resolveAndVerifyStore(auth, batch.getStoreId());
        batch.setStoreId(verifiedStoreId);
        return batchService.createBatch(batch);
    }

    @GetMapping("/my-batches")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getMyBatches(Authentication auth) {
        String verifiedStoreId = resolveAndVerifyStore(auth, null);
        return batchRepository.findByStoreId(verifiedStoreId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch getBatch(@PathVariable String id, Authentication auth) {
        Batch batch = batchService.getBatch(id);
        resolveAndVerifyStore(auth, batch.getStoreId());
        return batch;
    }

    @GetMapping("/store/{storeId}")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public List<Batch> getBatchesForStore(@PathVariable String storeId, Authentication auth) {
        String verifiedStoreId = resolveAndVerifyStore(auth, storeId);
        return batchRepository.findByStoreId(verifiedStoreId);
    }

    @PostMapping(value = "/{id}/scan", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('STORE_MANAGER', 'STORE_STAFF')")
    public Batch scanBatch(@PathVariable String id, @RequestParam("image") MultipartFile image,
                           Authentication auth) throws IOException {
        Batch batch = batchService.getBatch(id);
        resolveAndVerifyStore(auth, batch.getStoreId());
        return batchService.scanBatch(id, image.getBytes(), image.getOriginalFilename());
    }
}