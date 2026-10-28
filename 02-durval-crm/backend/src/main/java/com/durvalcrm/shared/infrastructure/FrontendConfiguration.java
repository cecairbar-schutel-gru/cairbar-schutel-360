package com.durvalcrm.shared.infrastructure;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RequestPredicates;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerResponse;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serve o SPA (frontend/dist, copiado para classpath:/static/ no build do WAR). Rotas do React
 * Router sem arquivo correspondente recebem o index.html; a API e o actuator nunca caem nele.
 */
@Configuration
public class FrontendConfiguration implements WebMvcConfigurer {

    private static final String LOCAL = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Arquivos com hash no nome (Vite): podem ficar em cache indefinidamente.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(LOCAL + "assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
        // index.html e demais arquivos: sempre revalidados, para uma nova versão valer na hora.
        registry.addResourceHandler("/**")
                .addResourceLocations(LOCAL)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(false)
                .addResolver(new RotasDoSpaResolver());
    }

    /** A raiz não passa pelos handlers de recursos (caminho vazio): devolve o index.html em UTF-8. */
    @Bean
    RouterFunction<ServerResponse> raizDoSpa() {
        Resource indice = new ClassPathResource("static/index.html");
        return RouterFunctions.route(RequestPredicates.GET("/").or(RequestPredicates.HEAD("/")), requisicao -> indice.isReadable()
                ? ServerResponse.ok()
                        .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                        .cacheControl(CacheControl.noCache())
                        .body(indice)
                : ServerResponse.notFound().build());
    }

    static class RotasDoSpaResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String caminho, Resource local) throws IOException {
            Resource recurso = super.getResource(caminho, local);
            if (recurso != null) {
                return recurso;
            }
            if (caminho.startsWith("api/") || caminho.startsWith("actuator/") || caminho.startsWith("assets/")) {
                return null;
            }
            Resource indice = local.createRelative("index.html");
            return indice.isReadable() ? indice : null;
        }
    }
}
