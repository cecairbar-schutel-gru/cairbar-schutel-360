import { createContext, useContext, type ReactNode } from "react";
import { useAccountApi, type Profile } from "./api";
import { useAsync, type AsyncState } from "./useAsync";

const ProfileContext = createContext<AsyncState<Profile> | undefined>(undefined);

/** Perfil carregado uma vez e compartilhado por cabeçalho, Início, Meus dados e Carteirinha. */
export function ProfileProvider(props: { children: ReactNode }) {
    const api = useAccountApi();
    const state = useAsync(signal => api.getProfile(signal));
    return <ProfileContext.Provider value={state}>{props.children}</ProfileContext.Provider>;
}

export function useProfile(): AsyncState<Profile> {
    const state = useContext(ProfileContext);
    if (state === undefined) {
        throw new Error("ProfileProvider ausente");
    }
    return state;
}
