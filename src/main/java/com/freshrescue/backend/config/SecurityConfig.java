package com.freshrescue.backend.config;

import com.freshrescue.backend.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * SECURITY CHANGES vs. the previous version:
 * - CORS: the hardcoded wildcard patterns (*.vercel.app, *.onrender.com,
 * localhost:*) are gone.
 * Only the origins listed in the cors.allowed-origins property (env var
 * CORS_ALLOWED_ORIGINS) are allowed.
 * - Credentials are disabled: the app authenticates with an Authorization
 * header, not cookies.
 * - Only the headers the frontend really needs are allowed.
 * - /api/cloud-sync/** now has a role rule here as well as the @PreAuthorize
 * annotations (defense in depth).
 * - Public endpoints (listings, images) are public for GET only; any write to
 * them needs a login.
 * - Explicit security headers for a JSON API.
 */
@Configuration
@RequiredArgsConstructor
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    /**
     * Comma-separated list of exact origins, e.g.
     * CORS_ALLOWED_ORIGINS=https://final-year-major-project-ashen.vercel.app
     * Local development defaults are defined in application.yml.
     */
    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,https://final-year-major-project-ashen.vercel.app}")
    private List<String> allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = allowedOrigins == null ? List.<String>of()
                : allowedOrigins.stream()
                        .map(String::trim)
                        .map(o -> o.replaceAll("/+$", ""))
                        .filter(o -> !o.isEmpty() && !o.equals("*")) // never allow a bare wildcard
                        .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setAllowCredentials(false); // JWT travels in the Authorization header, not in cookies
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
                .headers(headers -> headers
                        .contentSecurityPolicy(
                                csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(ref -> ref.policy(ReferrerPolicy.NO_REFERRER)))
                .authorizeHttpRequests(auth -> auth
                        // CORS preflight must never require a token
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/config/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/listings/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/images/**").permitAll()
                        .requestMatchers("/error").permitAll()

                        // Role-restricted
                        .requestMatchers("/api/batches/**").hasAnyRole("STORE_MANAGER", "STORE_STAFF")
                        .requestMatchers("/api/orders/**").hasAnyRole("NGO", "CUSTOMER", "STORE_MANAGER", "STORE_STAFF")
                        .requestMatchers("/api/watchlist/**").hasAnyRole("NGO", "CUSTOMER")
                        .requestMatchers("/api/cloud-sync/**")
                        .hasAnyRole("NGO", "CUSTOMER", "STORE_MANAGER", "STORE_STAFF")

                        // Everything else needs a valid login
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}