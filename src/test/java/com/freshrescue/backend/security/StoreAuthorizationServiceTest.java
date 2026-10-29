package com.freshrescue.backend.security;

import com.freshrescue.backend.entity.Store;
import com.freshrescue.backend.entity.User;
import com.freshrescue.backend.repository.StoreRepository;
import com.freshrescue.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreAuthorizationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private Authentication auth;

    private StoreAuthorizationService authorizationService;

    @BeforeEach
    void setUp() {
        authorizationService = new StoreAuthorizationService(userRepository, storeRepository);
    }

    @Test
    @DisplayName("only real store ids pass; a store whose NAME equals another store's id does NOT pass")
    void testRealStoreIdsOnlyAndRejectStoreNameMatchingAnId() {
        String userId = "user-123";
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getName()).thenReturn(userId);
        when(auth.getDetails()).thenReturn("store-jwt");

        // User record has storeId "store-user"
        User user = User.builder()
                .id(userId)
                .email("manager@freshrescue.com")
                .storeId("store-user")
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // User manages a store where id is "store-real", but name happens to equal "store-victim-id"
        Store managedStore = Store.builder()
                .id("store-real")
                .name("store-victim-id") // store name matches an ID string
                .managerId(userId)
                .build();
        when(storeRepository.findByManagerId(userId)).thenReturn(List.of(managedStore));

        Set<String> authorizedIds = authorizationService.getAuthorizedStoreIds(auth);

        // 1. All real store IDs must pass
        assertTrue(authorizedIds.contains("store-jwt"));
        assertTrue(authorizedIds.contains("store-user"));
        assertTrue(authorizedIds.contains("store-real"));

        assertTrue(authorizationService.isAuthorizedForStore(auth, "store-jwt"));
        assertTrue(authorizationService.isAuthorizedForStore(auth, "store-user"));
        assertTrue(authorizationService.isAuthorizedForStore(auth, "store-real"));

        assertEquals("store-real", authorizationService.resolveAndVerifyStore(auth, "store-real"));

        // 2. The store whose NAME equals "store-victim-id" MUST NOT pass authorization
        assertFalse(authorizedIds.contains("store-victim-id"),
                "Store name must NEVER be included in authorized store IDs");
        assertFalse(authorizationService.isAuthorizedForStore(auth, "store-victim-id"),
                "Authorization must reject a store name even if it matches another store's ID");

        assertThrows(AccessDeniedException.class, () ->
                authorizationService.resolveAndVerifyStore(auth, "store-victim-id"));

        // 3. Foreign store ID must be rejected
        assertFalse(authorizationService.isAuthorizedForStore(auth, "store-unknown"));
        assertThrows(AccessDeniedException.class, () ->
                authorizationService.resolveAndVerifyStore(auth, "store-unknown"));
    }
}

