import { MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { rotuloLote } from '../regras'
import { estoqueService } from '../services'

interface Props {
  produto: { id: number; nome: string }
  onFechar(): void
  onConcluido(mensagem: string): void
}

/**
 * Ajuste após contagem física (US-INVENTORY-016). A diminuição numa remessa consignada é tratada
 * como baixa por extravio, que gera a obrigação com a editora.
 */
export function AjusteEstoqueModal({ produto, onFechar, onConcluido }: Props) {
  const detalhe = useCarregamento(() => estoqueService.detalhe(produto.id), [produto.id])
  const [lote, setLote] = useState('proprio')
  const [contada, setContada] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const lotes = detalhe.dados?.lotes ?? []
  const opcoes = lotes.some((l) => l.remessaId === null)
    ? lotes
    : [{ remessaId: null, remessaCodigo: null, quantidade: 0 }, ...lotes]
  const escolhido = opcoes.find((l) => String(l.remessaId ?? 'proprio') === lote)
  const saldo = escolhido?.quantidade ?? 0
  const diferenca = contada === '' ? null : Number(contada) - saldo

  async function enviar() {
    setEnviando(true)
    setErro(null)
    try {
      const r = await estoqueService.ajustar(produto.id, {
        remessaId: escolhido?.remessaId ?? null,
        quantidadeContada: Number(contada),
        motivo: motivo.trim(),
      })
      onConcluido(
        r.tipo === 'AJUSTE'
          ? `Estoque de ${produto.nome} ajustado (${r.diferenca > 0 ? '+' : ''}${r.diferenca}).`
          : `Registrada baixa por extravio de ${-r.diferenca} ${-r.diferenca === 1 ? 'unidade' : 'unidades'} de ${produto.nome}, com obrigação para a editora.`,
      )
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={produto.nome}
      titulo="Ajustar estoque após contagem"
      textoConfirmar="Registrar ajuste"
      confirmarDesabilitado={contada === '' || diferenca === 0 || !motivo.trim() || enviando}
      onFechar={onFechar}
      onConfirmar={() => void enviar()}
    >
      <Pilha spacing={2}>
        {detalhe.carregando && <Carregando />}
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível ajustar">
            {erro}
          </Aviso>
        )}
        <GradeForm>
          {opcoes.length > 1 && (
            <TextField select label="Lote" value={lote} onChange={(e) => setLote(e.target.value)}>
              {opcoes.map((l) => (
                <MenuItem key={l.remessaId ?? 'proprio'} value={String(l.remessaId ?? 'proprio')}>
                  {rotuloLote(l)} — saldo {l.quantidade}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Quantidade contada"
            required
            value={contada}
            onChange={(e) => setContada(e.target.value.replace(/\D/g, ''))}
            helperText={`Saldo no sistema: ${saldo}${diferenca !== null ? ` · diferença ${diferenca > 0 ? '+' : ''}${diferenca}` : ''}`}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
        </GradeForm>
        {escolhido?.remessaId != null && diferenca !== null && diferenca < 0 && (
          <Aviso tipo="warning" titulo="Baixa por extravio">
            A falta numa remessa consignada é registrada como baixa por extravio e gera obrigação com a editora.
          </Aviso>
        )}
        <TextoSuave>Use quando a diferença não se explica por uma baixa. O resultado nunca fica negativo.</TextoSuave>
        <TextField label="Motivo" required multiline minRows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Pilha>
    </DialogoAcao>
  )
}
