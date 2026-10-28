import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { keycloakify } from "keycloakify/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        keycloakify({
            themeName: "cecairbar",
            accountThemeImplementation: "Single-Page",
            // Keycloak instalado pelo Ansible (global_vars/main.yml: keycloak_version 26.8.1).
            keycloakVersionTargets: {
                "22-to-25": false,
                "all-other-versions": "cecairbar-theme.jar"
            }
        })
    ]
});
