import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { TextoSuave } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { intencaoService } from '../services'
import { TabelaIntencoes } from './TabelaIntencoes'

/** As intenções pendentes ou divergentes do Operador, no painel dele (wireframe 1). */
export function MinhasIntencoesResumo({ limite = 5 }: { limite?: number }) {
  const lista = useCarregamento(() => intencaoService.minhas(), [])
  if (lista.carregando) return <Carregando linhas={2} />
  if (lista.erro) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {lista.erro}
      </Aviso>
    )
  }
  const todas = lista.dados ?? []
  const itens = todas.filter((i) => i.novidade || ['PENDENTE', 'DIVERGENTE', 'AGUARDANDO_RECEBIMENTO'].includes(i.status)).slice(0, limite)
  return (
    <>
      {itens.length === 0 ? (
        <TextoSuave>Nenhuma intenção em andamento.</TextoSuave>
      ) : (
        <TabelaIntencoes rotulo="Minhas intenções em andamento" itens={itens} comAprovado />
      )}
      {todas.length > 0 && <LinkRota to="/intencoes-gasto">Ver todas as minhas intenções</LinkRota>}
    </>
  )
}

/** Compras aprovadas que esperam a conferência do Vendedor, no painel dele (wireframe 2). */
export function ComprasAguardandoRecebimento() {
  const lista = useCarregamento(() => intencaoService.recebimentos(), [])
  if (lista.carregando) return <Carregando linhas={2} />
  if (lista.erro) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {lista.erro}
      </Aviso>
    )
  }
  const itens = lista.dados ?? []
  if (itens.length === 0) return <TextoSuave>Nenhuma compra aguardando recebimento.</TextoSuave>
  return <TabelaIntencoes rotulo="Compras aguardando recebimento" itens={itens} comProdutos textoLink="Conferir" />
}

/** Contadores de gastos para o painel do Administrador (US-EXPENSE-002). */
export function GastosAguardandoDecisao() {
  const contadores = useCarregamento(() => intencaoService.contadores(), [])
  const c = contadores.dados
  if (!c || c.pendentes + c.divergentes === 0) return null
  return (
    <Aviso tipo="warning" titulo="Gastos aguardando a Tesouraria" acao={<LinkRota to="/intencoes-gasto/aprovacao">Abrir</LinkRota>}>
      {c.pendentes} {c.pendentes === 1 ? 'intenção pendente' : 'intenções pendentes'} de aprovação
      {c.divergentes > 0 && ` e ${c.divergentes} ${c.divergentes === 1 ? 'compra divergente' : 'compras divergentes'}`}.
    </Aviso>
  )
}
