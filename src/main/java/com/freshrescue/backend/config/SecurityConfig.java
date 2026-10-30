package com.freshrescue.backend.config;

import com.freshrescue.backend.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
@EnableMethodSecurity // REQUIRED for @PreAuthorize to actually be enforced on controllers -
// without this, Spring Security 6 silently ignores every @PreAuthorize
// annotation and only the request-matcher rules below apply.
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private List<String> allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        java.util.List<String> patterns = new java.util.ArrayList<>(List.of(
            "http://localhost:*",
            "http://127.0.0.1:*",
            "https://*.vercel.app",
            "https://*.onrender.com"
        ));
        if (allowedOrigins != null) {
            patterns.addAll(allowedOrigins);
        }
        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable) // stateless JWT API, no cookies involved
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/config/**").permitAll()
                        .requestMatchers("/api/listings/**").permitAll()
                        .requestMatchers("/api/images/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/batches/**").hasAnyRole("STORE_MANAGER", "STORE_STAFF")
                        .requestMatchers("/api/orders/**").hasAnyRole("NGO", "CUSTOMER", "STORE_MANAGER", "STORE_STAFF")
                        .requestMatchers("/api/watchlist/**").hasAnyRole("NGO", "CUSTOMER")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}