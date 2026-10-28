import { useCallback, useEffect, useState } from 'react'
import { mensagemDeErro } from '../api/http'

interface Estado<T> {
  dados: T | null
  carregando: boolean
  erro: string | null
}

/** Carrega dados assíncronos e descarta respostas de requisições superadas. */
export function useCarregamento<T>(carregar: () => Promise<T>, dependencias: unknown[]) {
  const [estado, setEstado] = useState<Estado<T>>({ dados: null, carregando: true, erro: null })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado((e) => ({ ...e, carregando: true, erro: null }))
    carregar().then(
      (dados) => ativo && setEstado({ dados, carregando: false, erro: null }),
      (erro) => ativo && setEstado({ dados: null, carregando: false, erro: mensagemDeErro(erro) }),
    )
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { ...estado, recarregar }
}
