import { useMemo } from "react";
import { useEnvironment } from "../../shared/keycloak-ui-shared";
import type { AccountEnvironment } from "..";
import { createKeycloakAccountApi } from "./keycloakAccountApi";
import { Portal } from "./Portal";
import { SessionExpiryDialog } from "./SessionExpiryDialog";

/** Portal ligado ao Keycloak real (dentro do KeycloakProvider do account-ui). */
export function KeycloakPortal() {
    const context = useEnvironment<AccountEnvironment>();
    const api = useMemo(() => createKeycloakAccountApi(context), [context.keycloak]);
    const basename = decodeURIComponent(new URL(context.environment.baseUrl).pathname).replace(/\/$/, "");
    const { oidc } = context.keycloak;

    return (
        <>
            <Portal api={api} basename={basename} />
            {oidc.isUserLoggedIn && (
                <SessionExpiryDialog subscribe={oidc.subscribeToAutoLogoutCountdown} warnSecondsBefore={45} />
            )}
        </>
    );
}
