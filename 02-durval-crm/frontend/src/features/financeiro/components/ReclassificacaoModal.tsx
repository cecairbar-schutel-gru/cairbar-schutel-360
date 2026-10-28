import { MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { financeiroService } from '../services'
import type { DetalheLancamento } from '../types'
import { SeletorCategoria } from './SeletorCategoria'

interface Props {
  lancamento: DetalheLancamento
  onFechar(): void
  onConcluido(atualizado: DetalheLancamento): void
}

/**
 * Reclassificação (US-FINANCIAL-021): só a subcategoria muda, para outra ativa do mesmo tipo;
 * valor, data e conta ficam e a classificação anterior vai para o histórico.
 */
export function ReclassificacaoModal({ lancamento: l, onFechar, onConcluido }: Props) {
  const categorias = useCarregamento(() => financeiroService.categorias(), [])
  const [ordem, setOrdem] = useState(0)
  const [categoria, setCategoria] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const linha = l.linhasCategoria[ordem]

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      onConcluido(await financeiroService.reclassificar(l.id, ordem, categoria, motivo.trim()))
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={`Lançamento nº ${l.id}`}
      titulo="Reclassificar lançamento"
      textoConfirmar="Reclassificar"
      confirmarDesabilitado={!categoria || !motivo.trim() || enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>Valor, data e conta não mudam. Os relatórios passam a usar a nova classificação.</TextoSuave>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível reclassificar">
            {erro}
          </Aviso>
        )}
        {l.linhasCategoria.length > 1 && (
          <TextField select label="Linha a reclassificar" value={ordem} onChange={(e) => { setOrdem(Number(e.target.value)); setCategoria('') }}>
            {l.linhasCategoria.map((c) => (
              <MenuItem key={c.ordem} value={c.ordem}>
                {c.nome} — {formatarMoeda(c.valor)}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextoSuave>Classificação atual: {linha?.nome}</TextoSuave>
        {categorias.dados && linha?.tipo && (
          <GradeForm>
            <SeletorCategoria
              key={ordem}
              categorias={categorias.dados}
              tipo={linha.tipo}
              filtro={(c) => c.ativa && c.codigo !== linha.codigo}
              valor={categoria}
              onAlterar={setCategoria}
            />
          </GradeForm>
        )}
        <TextField label="Motivo" required multiline minRows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Pilha>
    </DialogoAcao>
  )
}
