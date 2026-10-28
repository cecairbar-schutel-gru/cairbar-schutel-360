import { lazy, useMemo } from "react";
import {
    createBrowserRouter,
    createMemoryRouter,
    Navigate,
    RouterProvider,
    type RouteObject
} from "react-router-dom";
import { ThemeRoot } from "../../shared/ThemeRoot";
import { AccountApiContext, type AccountApi } from "./api";
import { PortalLayout } from "./PortalLayout";
import { ProfileProvider } from "./ProfileContext";

const Inicio = lazy(() => import("./pages/Inicio"));
const MeusDados = lazy(() => import("./pages/MeusDados"));
const Carteirinha = lazy(() => import("./pages/Carteirinha"));
const Seguranca = lazy(() => import("./pages/Seguranca"));
const Dispositivos = lazy(() => import("./pages/Dispositivos"));
const Equipes = lazy(() => import("./pages/Equipes"));
const Aplicacoes = lazy(() => import("./pages/Aplicacoes"));

// Comportamento do React Router 7 já adotado (evita avisos e facilita a atualização).
const future = {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
};

const routes: RouteObject[] = [
    {
        path: "/",
        element: <PortalLayout />,
        children: [
            { index: true, element: <Inicio /> },
            { path: "meus-dados", element: <MeusDados /> },
            { path: "carteirinha", element: <Carteirinha /> },
            { path: "seguranca", element: <Seguranca /> },
            { path: "dispositivos", element: <Dispositivos /> },
            { path: "equipes", element: <Equipes /> },
            { path: "aplicacoes", element: <Aplicacoes /> },
            // Caminhos do account console padrão, usados em links do próprio Keycloak.
            { path: "personal-info", element: <Navigate to="/meus-dados" replace /> },
            { path: "account-security/signing-in", element: <Navigate to="/seguranca" replace /> },
            { path: "account-security/device-activity", element: <Navigate to="/dispositivos" replace /> },
            { path: "applications", element: <Navigate to="/aplicacoes" replace /> },
            { path: "groups", element: <Navigate to="/equipes" replace /> },
            { path: "*", element: <Navigate to="/" replace /> }
        ]
    }
];

/**
 * Comunidade Cairbar (tema account). Fora do portal, por não haver caso de uso: contas
 * vinculadas, organizações, recursos UMA e credenciais verificáveis.
 *
 * @param basename caminho do account console (ex.: /realms/cecairbar/account)
 * @param initialPath usa roteador em memória (Storybook/testes) iniciando nesse caminho
 */
export function Portal(props: { api: AccountApi; basename: string; initialPath?: string }) {
    const { api, basename, initialPath } = props;

    const router = useMemo(
        () =>
            initialPath === undefined
                ? createBrowserRouter(routes, { basename, future })
                : createMemoryRouter(routes, { initialEntries: [initialPath], future }),
        [basename, initialPath]
    );

    return (
        <ThemeRoot>
            <AccountApiContext.Provider value={api}>
                <ProfileProvider>
                    <RouterProvider router={router} future={{ v7_startTransition: true }} />
                </ProfileProvider>
            </AccountApiContext.Provider>
        </ThemeRoot>
    );
}
