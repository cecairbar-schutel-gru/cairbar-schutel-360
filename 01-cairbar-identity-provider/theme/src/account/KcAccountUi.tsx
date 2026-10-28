/**
 * Arquivo assumido (npx keycloakify own) a partir do @keycloakify/keycloak-account-ui 260700.0.4.
 *
 * Mantém a inicialização do account-ui (KeycloakProvider: oidc-spa com PKCE, tokens só em
 * memória, i18n usado pela página de erro) e troca a interface PatternFly pela Comunidade
 * Cairbar em MUI (./portal). Sem o CSS do PatternFly para não conflitar com o tema MUI.
 */

import { useReducer, useEffect } from "react";
import { KeycloakProvider } from "../shared/keycloak-ui-shared";
import { environment } from "./environment";
import { i18n } from "./i18n/i18n";
import { KeycloakPortal } from "./portal/KeycloakPortal";
import { portal } from "../shared/i18n/pt-BR";

document.title = portal.productName;

const prI18nInitialized = i18n.init();

export default function KcAccountUi() {
    const [isI18nInitialized, setI18nInitialized] = useReducer(() => true, false);

    useEffect(() => {
        prI18nInitialized.then(() => setI18nInitialized());
    }, []);

    if (!isI18nInitialized) {
        return null;
    }

    return (
        <KeycloakProvider environment={environment}>
            <KeycloakPortal />
        </KeycloakProvider>
    );
}
