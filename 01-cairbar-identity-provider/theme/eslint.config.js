import typescriptEslint from "typescript-eslint";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import js from "@eslint/js";
import storybook from "eslint-plugin-storybook";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  eslintConfigPrettier,
  ...storybook.configs["flat/recommended"],
  {
    // src/account e src/shared: código do @keycloakify/keycloak-account-ui copiado pelo
    // "keycloakify sync-extensions" (listado em src/.gitignore); só o nosso código é verificado.
    ignores: [
      "dist/**",
      "dist_keycloak/**",
      "public/**",
      "storybook-static/**",
      "src/kc.gen.tsx",
      "src/shared/keycloak-ui-shared/**",
      "src/shared/@patternfly/**",
      "src/shared/SessionExpirationWarningOverlay.tsx",
      "src/account/!(portal|KcAccountUi.tsx)/**",
      "src/account/*.ts",
      "src/account/KcPage.tsx",
      "src/account/routes.tsx",
    ],
  },
  {
    plugins: {
      "react-refresh": reactRefresh,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-redeclare": "off",
      "no-labels": "off",
      // Telas de login têm uma única tarefa: o foco inicial no primeiro campo (como no tema
      // padrão do Keycloak) é intencional nos componentes MUI; segue proibido em elementos DOM.
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    },
  },
  {
    files: ["**/*.stories.*"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
);
