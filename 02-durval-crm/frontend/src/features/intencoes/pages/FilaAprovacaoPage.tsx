import { Tab, Tabs } from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { TabelaIntencoes } from '../components/TabelaIntencoes'
import { intencaoService } from '../services'
import type { FiltroFila } from '../types'

const VAZIO: Record<FiltroFila, string> = {
  PENDENTE: 'Nenhuma intenção aguardando aprovação.',
  DIVERGENTE: 'Nenhuma compra com recebimento divergente.',
  TODAS: 'Nenhuma intenção de gasto registrada.',
}

/**
 * Fila da Tesouraria (US-EXPENSE-002): pendentes das mais antigas para as mais novas, aba separada
 * para as compras divergentes (US-EXPENSE-007) e o histórico completo.
 */
export function FilaAprovacaoPage() {
  const [aba, setAba] = useState<FiltroFila>('PENDENTE')
  const contadores = useCarregamento(() => intencaoService.contadores(), [aba])
  const lista = useCarregamento(() => intencaoService.fila(aba), [aba])
  const itens = lista.dados ?? []
  const c = contadores.dados
  return (
    <Pilha component="section" aria-labelledby="titulo-fila">
      <TituloPagina id="titulo-fila">Aprovação de gastos</TituloPagina>
      <TextoSuave>
        Abra a intenção para ver anexos e o gasto do mês na subcategoria. A aprovação registra a despesa na conta de origem;
        não existe aprovação parcial por item.
      </TextoSuave>
      <Tabs value={aba} onChange={(_, v: FiltroFila) => setAba(v)} aria-label="Situação das intenções">
        <Tab value="PENDENTE" label={c ? `Pendentes (${c.pendentes})` : 'Pendentes'} />
        <Tab value="DIVERGENTE" label={c ? `Divergentes (${c.divergentes})` : 'Divergentes'} />
        <Tab value="TODAS" label="Todas" />
      </Tabs>
      {lista.carregando && <Carregando />}
      {lista.erro && (
        <Aviso tipo="error" titulo="Erro">
          {lista.erro}
        </Aviso>
      )}
      {!lista.carregando && !lista.erro && itens.length === 0 && <TextoSuave>{VAZIO[aba]}</TextoSuave>}
      {itens.length > 0 && (
        <TabelaIntencoes
          rotulo="Intenções de gasto"
          itens={itens}
          comSolicitante
          comAprovado={aba !== 'PENDENTE'}
          textoLink={aba === 'TODAS' ? 'Abrir' : 'Analisar'}
        />
      )}
    </Pilha>
  )
}
