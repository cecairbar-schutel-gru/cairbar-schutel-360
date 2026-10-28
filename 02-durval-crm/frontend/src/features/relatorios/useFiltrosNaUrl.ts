import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { lerPeriodo } from './regras'
import type { Periodo } from './types'

type Valor = string | number | boolean | undefined | null

/**
 * Filtros do relatório guardados na URL: o link pode ser compartilhado e, ao voltar do
 * drill-down, a tela reabre com os mesmos filtros.
 */
export function useFiltrosNaUrl() {
  const [parametros, setParametros] = useSearchParams()
  const alterar = useCallback(
    (novos: Record<string, Valor>) =>
      setParametros(
        (atuais) => {
          const q = new URLSearchParams(atuais)
          for (const [chave, valor] of Object.entries(novos)) {
            if (valor === undefined || valor === null || valor === '' || valor === false) q.delete(chave)
            else q.set(chave, String(valor))
          }
          return q
        },
        { replace: true },
      ),
    [setParametros],
  )
  const definirPeriodo = useCallback((p: Periodo) => alterar({ de: p.de, ate: p.ate, mes: undefined }), [alterar])
  const texto = (chave: string) => parametros.get(chave) ?? ''
  const numero = (chave: string) => (parametros.get(chave) ? Number(parametros.get(chave)) : undefined)
  return { parametros, periodo: lerPeriodo(parametros), alterar, definirPeriodo, texto, numero }
}
