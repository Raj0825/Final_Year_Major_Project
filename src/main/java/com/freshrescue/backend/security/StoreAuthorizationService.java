package com.freshrescue.backend.security;

import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreAuthorizationService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    /**
     * Resolves all legitimate store IDs associated with the authenticated principal.
     * Checks:
     *   1) JWT storeId details claim
     *   2) User.storeId in DB
     *   3) Stores where managerId == user.id
     * NOTE: Store names are NEVER used as identifiers.
     */
    public Set<String> getAuthorizedStoreIds(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptySet();
        }

        String principal = auth.getName();
        User user = userRepository.findById(principal).orElse(null);
        if (user == null) {
            user = userRepository.findByEmail(principal.toLowerCase().trim()).orElse(null);
        }

        Set<String> storeIds = new HashSet<>();

        // 1. JWT Details storeId
        Object details = auth.getDetails();
        if (details instanceof String detailsStr && !detailsStr.isBlank()) {
            storeIds.add(detailsStr.trim());
        }

        // 2. User entity storeId
        if (user != null && user.getStoreId() != null && !user.getStoreId().isBlank()) {
            storeIds.add(user.getStoreId().trim());
        }

        // 3. Stores managed by user (by real user ID only)
        String userId = user != null ? user.getId() : principal;
        List<Store> managed = storeRepository.findByManagerId(userId);
        for (Store s : managed) {
            if (s.getId() != null && !s.getId().isBlank()) {
                storeIds.add(s.getId().trim());
            }
        }

        return storeIds;
    }

    /**
     * Checks whether the authenticated user is authorized for the given storeId.
     */
    public boolean isAuthorizedForStore(Authentication auth, String storeId) {
        if (storeId == null || storeId.isBlank()) {
            return false;
        }
        String cleanId = storeId.trim();
        return getAuthorizedStoreIds(auth).stream()
                .anyMatch(id -> id.equalsIgnoreCase(cleanId));
    }

    /**
     * Verifies that the requestedStoreId is authorized for the caller.
     * If requestStoreId is null or blank, returns the primary authorized store ID.
     * If not authorized, throws AccessDeniedException.
     */
    public String resolveAndVerifyStore(Authentication auth, String requestStoreId) {
        Set<String> authorized = getAuthorizedStoreIds(auth);
        if (authorized.isEmpty()) {
            throw new AccessDeniedException("No store associated with your account.");
        }

        if (requestStoreId != null && !requestStoreId.isBlank()) {
            String clean = requestStoreId.trim();
            String matched = authorized.stream()
                    .filter(id -> id.equalsIgnoreCase(clean))
                    .findFirst()
                    .orElse(null);
            if (matched == null) {
                throw new AccessDeniedException("You do not have access to store: " + clean);
            }
            return matched;
        }

        // Default to the first authorized store ID
        return authorized.iterator().next();
    }
}

