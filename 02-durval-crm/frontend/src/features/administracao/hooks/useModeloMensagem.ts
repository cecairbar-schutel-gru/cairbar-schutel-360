import { useEffect, useState } from 'react'
import { MODELO_AGRADECIMENTO_PADRAO, MODELO_ANIVERSARIO_PADRAO, NOME_ORGANIZACAO } from '../../../shared/config/organizacao'
import { administracaoService } from '../services'
import type { TextosModelo, TipoModelo } from '../types'

interface Modelos {
  textos: Record<TipoModelo, TextosModelo>
  organizacao: string
}

const PADRAO: Modelos = {
  textos: { AGRADECIMENTO: MODELO_AGRADECIMENTO_PADRAO, ANIVERSARIO: MODELO_ANIVERSARIO_PADRAO },
  organizacao: NOME_ORGANIZACAO,
}

let carregados: Promise<Modelos> | null = null

/** Os modelos mudam pouco: uma leitura por sessão, refeita depois que o Administrador salva um. */
export function invalidarModelosMensagem(): void {
  carregados = null
}

function carregar(): Promise<Modelos> {
  carregados ??= Promise.all([
    administracaoService.modelos(),
    administracaoService.organizacao().catch(() => null),
  ]).then(
    ([modelos, organizacao]) => ({
      textos: { ...PADRAO.textos, ...Object.fromEntries(modelos.map((m) => [m.tipo, m])) },
      organizacao: organizacao?.nomeExibicao ?? NOME_ORGANIZACAO,
    }),
    () => {
      carregados = null
      return PADRAO
    },
  )
  return carregados
}

/**
 * Modelo de mensagem configurado (US-ADMIN-003) e o nome da organização para a variável
 * {organizacao}; enquanto carrega (ou se falhar) valem os textos da instalação.
 */
export function useModeloMensagem(tipo: TipoModelo): { modelo: TextosModelo; organizacao: string; carregando: boolean } {
  const [modelos, setModelos] = useState<Modelos | null>(null)
  useEffect(() => {
    let ativo = true
    void carregar().then((m) => ativo && setModelos(m))
    return () => {
      ativo = false
    }
  }, [])
  const m = modelos ?? PADRAO
  return { modelo: m.textos[tipo], organizacao: m.organizacao, carregando: modelos === null }
}
