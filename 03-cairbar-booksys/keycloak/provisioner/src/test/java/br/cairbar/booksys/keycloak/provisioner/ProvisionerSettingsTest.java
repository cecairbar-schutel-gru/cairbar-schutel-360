package br.cairbar.booksys.keycloak.provisioner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ProvisionerSettingsTest {

    private static Map<String, String> minimal() {
        Map<String, String> env = new HashMap<>();
        env.put("KEYCLOAK_URL", "http://localhost:8180");
        env.put("KEYCLOAK_ADMIN_USERNAME", "admin");
        env.put("KEYCLOAK_ADMIN_PASSWORD", "secret");
        env.put("BOOKSYS_WEB_URLS", "https://biblioteca.example/, http://localhost:5173");
        return env;
    }

    @Test
    void appliesDefaults() {
        ProvisionerSettings settings = ProvisionerSettings.fromEnvironment(minimal());

        assertThat(settings.admin().realm()).isEqualTo("master");
        assertThat(settings.admin().clientId()).isEqualTo("admin-cli");
        assertThat(settings.realm().name()).isEqualTo("cecairbar");
        assertThat(settings.realm().apiClientSecret()).isEmpty();
    }

    @Test
    void normalisesWebUrls() {
        ProvisionerSettings settings = ProvisionerSettings.fromEnvironment(minimal());

        assertThat(settings.realm().webUrls()).containsExactly(
                URI.create("https://biblioteca.example"), URI.create("http://localhost:5173"));
    }

    @Test
    void acceptsClientCredentialsInsteadOfPassword() {
        Map<String, String> env = minimal();
        env.remove("KEYCLOAK_ADMIN_USERNAME");
        env.remove("KEYCLOAK_ADMIN_PASSWORD");
        env.put("KEYCLOAK_ADMIN_CLIENT_SECRET", "s3cr3t");

        assertThat(ProvisionerSettings.fromEnvironment(env).admin().clientSecret()).contains("s3cr3t");
    }

    @Test
    void requiresAdminCredentials() {
        Map<String, String> env = minimal();
        env.remove("KEYCLOAK_ADMIN_PASSWORD");

        assertThatThrownBy(() -> ProvisionerSettings.fromEnvironment(env))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("KEYCLOAK_ADMIN_PASSWORD");
    }

    @Test
    void requiresWebUrls() {
        Map<String, String> env = minimal();
        env.put("BOOKSYS_WEB_URLS", " ");

        assertThatThrownBy(() -> ProvisionerSettings.fromEnvironment(env))
                .hasMessageContaining("BOOKSYS_WEB_URLS");
    }
}
