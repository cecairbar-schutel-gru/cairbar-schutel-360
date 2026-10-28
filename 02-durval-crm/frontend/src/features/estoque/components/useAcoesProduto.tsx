import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { plural } from '../rotulos'
import { estoqueService } from '../services'
import type { TipoProduto } from '../types'
import { AjusteEstoqueModal } from './AjusteEstoqueModal'
import { ModalMotivo } from './ModalMotivo'
import { PrecoModal } from './PrecoModal'
import { SolicitarBaixaModal } from './SolicitarBaixaModal'

export interface ProdutoComAcoes {
  id: number
  tipo: TipoProduto
  nome: string
  preco: number
  ativo: boolean
  saldo: number
}

export interface AcaoProduto {
  rotulo: string
  executar(): void
}

type Modal = 'BAIXA' | 'PRECO_SOLICITACAO' | 'PRECO_DIRETO' | 'INATIVACAO_SOLICITACAO' | 'INATIVAR' | 'AJUSTE'

/**
 * Ações sobre um produto conforme o papel: o Vendedor pede baixa, novo preço e inativação da
 * cantina; o Administrador altera preço de livro, ajusta, inativa e reativa direto.
 */
export function useAcoesProduto(aoConcluir: (mensagem: string) => void, comHistorico = true) {
  const { possuiPapel } = useAuth()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState<{ modal: Modal; produto: ProdutoComAcoes } | null>(null)
  const admin = possuiPapel('administrador')
  const vendedor = possuiPapel('vendedor')

  const fechar = () => setAberto(null)
  const concluir = (mensagem: string) => {
    setAberto(null)
    aoConcluir(mensagem)
  }

  function acoes(p: ProdutoComAcoes): AcaoProduto[] {
    const abrir = (modal: Modal) => () => setAberto({ modal, produto: p })
    const lista: AcaoProduto[] = []
    if (comHistorico) lista.push({ rotulo: 'Ver histórico', executar: () => navegar(`/estoque/produtos/${p.id}`) })
    if (admin || vendedor) {
      lista.push({ rotulo: 'Editar cadastro', executar: () => navegar(`/estoque/produtos/${p.id}/editar`) })
    }
    if ((vendedor || admin) && p.saldo > 0) lista.push({ rotulo: 'Solicitar baixa', executar: abrir('BAIXA') })
    if (vendedor && p.tipo === 'CANTINA' && p.ativo) {
      lista.push({ rotulo: 'Solicitar novo preço', executar: abrir('PRECO_SOLICITACAO') })
      lista.push({ rotulo: 'Solicitar inativação', executar: abrir('INATIVACAO_SOLICITACAO') })
    }
    if ((admin || vendedor) && p.tipo === 'LIVRO') lista.push({ rotulo: 'Alterar preço', executar: abrir('PRECO_DIRETO') })
    if (admin) {
      lista.push({ rotulo: 'Ajustar estoque', executar: abrir('AJUSTE') })
      if (p.ativo) lista.push({ rotulo: 'Inativar', executar: abrir('INATIVAR') })
      else
        lista.push({
          rotulo: 'Reativar',
          executar: () =>
            void estoqueService.reativar(p.id).then(
              () => aoConcluir(`${p.nome} foi reativado.`),
              () => aoConcluir(`Não foi possível reativar ${p.nome}.`),
            ),
        })
    }
    return lista
  }

  let modal: ReactNode = null
  if (aberto) {
    const p = aberto.produto
    switch (aberto.modal) {
      case 'BAIXA':
        modal = <SolicitarBaixaModal produto={p} onFechar={fechar} onConcluido={concluir} />
        break
      case 'PRECO_SOLICITACAO':
      case 'PRECO_DIRETO':
        modal = (
          <PrecoModal produto={p} modo={aberto.modal === 'PRECO_DIRETO' ? 'DIRETO' : 'SOLICITACAO'} onFechar={fechar} onConcluido={concluir} />
        )
        break
      case 'AJUSTE':
        modal = <AjusteEstoqueModal produto={p} onFechar={fechar} onConcluido={concluir} />
        break
      case 'INATIVACAO_SOLICITACAO':
        modal = (
          <ModalMotivo
            rotulo={p.nome}
            titulo="Solicitar inativação"
            textoConfirmar="Enviar para aprovação"
            onFechar={fechar}
            onConfirmar={async (motivo) => {
              await estoqueService.solicitarInativacao(p.id, motivo)
              concluir(`Pedido de inativação de ${p.nome} enviado para aprovação.`)
            }}
          >
            {p.saldo > 0 && (
              <Aviso tipo="warning" titulo={`Ainda há ${plural(p.saldo, 'unidade', 'unidades')} em estoque`}>
                A inativação só é aprovada com o estoque zerado. Venda as unidades ou solicite a baixa antes.
              </Aviso>
            )}
          </ModalMotivo>
        )
        break
      case 'INATIVAR': {
        const bloqueado = p.tipo === 'CANTINA' && p.saldo > 0
        modal = (
          <ModalMotivo
            rotulo={p.nome}
            titulo="Inativar produto"
            textoConfirmar="Inativar"
            perigo
            bloqueado={bloqueado}
            onFechar={fechar}
            onConfirmar={async (motivo) => {
              await estoqueService.inativar(p.id, motivo)
              concluir(`${p.nome} foi inativado e saiu da tela de venda.`)
            }}
          >
            {p.saldo > 0 && (
              <Aviso tipo="warning" titulo={`Ainda há ${plural(p.saldo, 'unidade', 'unidades')} em estoque`}>
                {bloqueado
                  ? `Dê baixa ou venda as ${plural(p.saldo, 'unidade restante', 'unidades restantes')} antes de inativar.`
                  : 'Um título inativo não pode ser vendido; as unidades continuam no estoque e no histórico.'}
              </Aviso>
            )}
          </ModalMotivo>
        )
        break
      }
    }
  }

  return { acoes, modal }
}
