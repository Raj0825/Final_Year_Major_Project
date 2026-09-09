package com.freshrescue.backend.controller;

import com.freshrescue.backend.entity.Notification;
import com.freshrescue.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    public List<Notification> getMyNotifications(Authentication auth) {
        String userId = auth.getName();
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(Authentication auth) {
        String userId = auth.getName();
        long count = notificationRepository.countByUserIdAndReadFalse(userId);
        return Map.of("unreadCount", count);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable String id, Authentication auth) {
        String userId = auth.getName();
        return notificationRepository.findById(id)
                .map(n -> {
                    if (!userId.equals(n.getUserId())) {
                        return ResponseEntity.status(403).build();
                    }
                    n.setRead(true);
                    notificationRepository.save(n);
                    return ResponseEntity.ok(n);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(Authentication auth) {
        String userId = auth.getName();
        List<Notification> unread = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        for (Notification n : unread) {
            if (!n.isRead()) {
                n.setRead(true);
            }
        }
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }
}
