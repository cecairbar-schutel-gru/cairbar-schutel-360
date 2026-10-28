import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> = {
    data: T | undefined;
    error: unknown;
    loading: boolean;
    reload: () => void;
};

/**
 * Carrega dados com cancelamento (AbortController) ao desmontar ou recarregar.
 * @param deps recarrega quando mudarem (como no useEffect)
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> {
    const [data, setData] = useState<T>();
    const [error, setError] = useState<unknown>();
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(undefined);
        load(controller.signal).then(
            result => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            },
            reason => {
                if (!controller.signal.aborted) {
                    setError(reason);
                    setLoading(false);
                }
            }
        );
        return () => controller.abort();
    }, [version, ...deps]);

    const reload = useCallback(() => setVersion(v => v + 1), []);

    return { data, error, loading, reload };
}
