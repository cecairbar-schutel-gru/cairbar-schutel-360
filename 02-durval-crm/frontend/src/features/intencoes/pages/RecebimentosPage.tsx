import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { TabelaIntencoes } from '../components/TabelaIntencoes'
import { intencaoService } from '../services'

/** Compras da cantina aprovadas à espera da conferência do Vendedor (US-EXPENSE-006). */
export function RecebimentosPage() {
  const lista = useCarregamento(() => intencaoService.recebimentos(), [])
  const itens = lista.dados ?? []
  return (
    <Pilha component="section" aria-labelledby="titulo-recebimentos">
      <TituloPagina id="titulo-recebimentos">Receber compras</TituloPagina>
      <TextoSuave>
        Confira o que chegou de cada compra aprovada. Se tudo conferir, o estoque é atualizado; se houver diferença, a
        entrada fica bloqueada até a Tesouraria corrigir ou cancelar a compra.
      </TextoSuave>
      {lista.carregando && <Carregando />}
      {lista.erro && (
        <Aviso tipo="error" titulo="Erro">
          {lista.erro}
        </Aviso>
      )}
      {!lista.carregando && !lista.erro && itens.length === 0 && <TextoSuave>Nenhuma compra aguardando recebimento.</TextoSuave>}
      {itens.length > 0 && <TabelaIntencoes rotulo="Compras aguardando recebimento" itens={itens} comProdutos textoLink="Conferir" />}
    </Pilha>
  )
}
