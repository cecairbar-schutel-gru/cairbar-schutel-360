package com.durvalcrm.shared.security;

import com.durvalcrm.shared.adapter.in.rest.RespostaErro;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, KeycloakJwtAuthenticationConverter keycloakConverter,
            JsonMapper json) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/publico/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        // SPA embutido (FrontendConfiguration): arquivos estáticos e rotas do frontend.
                        .requestMatchers(HttpMethod.GET, "/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/**").permitAll()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakConverter))
                        .authenticationEntryPoint((req, res, e) -> escrever(res, json, HttpStatus.UNAUTHORIZED,
                                new RespostaErro("NAO_AUTENTICADO", "Sessão expirada. Entre novamente.", List.of())))
                        .accessDeniedHandler((req, res, e) -> escrever(res, json, HttpStatus.FORBIDDEN,
                                RespostaErro.acessoNegado())));
        return http.build();
    }

    private static void escrever(HttpServletResponse res, JsonMapper json, HttpStatus status, RespostaErro corpo)
            throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        json.writeValue(res.getOutputStream(), corpo);
    }
}
