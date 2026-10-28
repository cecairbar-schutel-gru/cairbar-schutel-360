import { useEffect } from 'react'

/** Título da aba: "<página> · Cairbar 360", ou só "Cairbar 360" no início. */
export function useTitulo(pagina?: string) {
  useEffect(() => {
    document.title = pagina ? `${pagina} · Cairbar 360` : 'Cairbar 360'
  }, [pagina])
}
