package com.livestockguard.controller;

import com.livestockguard.model.AppUser;
import com.livestockguard.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;

    public AuthController(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
        }

        Optional<AppUser> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            AppUser user = userOpt.get();
            // Basic simulation: compare plain text for demo, or mock it
            // In a real app we would use BCrypt or similar.
            if ("LOCAL".equals(user.getAuthProvider()) && password.equals(user.getPasswordHash())) {
                return ResponseEntity.ok(user);
            }
        }
        
        // Auto-register mock for local login if they don't exist (helpful for hackathon demo)
        // If you strictly want error on wrong password, we can do that.
        // Let's implement real behavior: Error if wrong, create if new.
        if (userOpt.isEmpty()) {
            AppUser newUser = new AppUser();
            newUser.setEmail(email);
            newUser.setName(email.split("@")[0]);
            newUser.setPasswordHash(password);
            newUser.setAuthProvider("LOCAL");
            AppUser saved = userRepository.save(newUser);
            return ResponseEntity.ok(saved);
        }

        return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String name = payload.get("name");

        if (email == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email required for Google login"));
        }

        Optional<AppUser> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            // Existing user, log them in automatically
            return ResponseEntity.ok(userOpt.get());
        }

        // New user, register them
        AppUser newUser = new AppUser();
        newUser.setEmail(email);
        newUser.setName(name != null ? name : "Google User");
        newUser.setAuthProvider("GOOGLE");
        AppUser saved = userRepository.save(newUser);
        
        return ResponseEntity.ok(saved);
    }
}
