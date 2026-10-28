import { MenuItem, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { disponivelParaBaixa, lerComoBase64, loteSugerido, rotuloLote } from '../regras'
import { ROTULO_MOTIVO_BAIXA } from '../rotulos'
import { estoqueService } from '../services'
import { MAXIMO_FOTO_BYTES, type MotivoBaixa } from '../types'

interface Props {
  produto: { id: number; nome: string }
  onFechar(): void
  onConcluido(mensagem: string): void
}

/**
 * Pedido de baixa (US-INVENTORY-007): o lote vem pré-selecionado pela ordem de saída e pode ser
 * trocado pela remessa a que as unidades pertencem. O estoque só muda na aprovação.
 */
export function SolicitarBaixaModal({ produto, onFechar, onConcluido }: Props) {
  const detalhe = useCarregamento(() => estoqueService.detalhe(produto.id), [produto.id])
  const [loteEscolhido, setLote] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState('1')
  const [motivo, setMotivo] = useState<MotivoBaixa | ''>('')
  const [justificativa, setJustificativa] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const lotes = detalhe.dados?.lotes ?? []
  const sugerido = loteSugerido(lotes)
  const lote = loteEscolhido ?? (sugerido ? String(sugerido.remessaId ?? 'proprio') : '')

  const escolhido = lotes.find((l) => String(l.remessaId ?? 'proprio') === lote) ?? null
  const disponivel = escolhido ? disponivelParaBaixa(escolhido) : 0
  const qtd = Number(quantidade)
  const quantidadeValida = Number.isInteger(qtd) && qtd > 0 && qtd <= disponivel
  const fotoGrande = foto !== null && foto.size > MAXIMO_FOTO_BYTES

  async function enviar() {
    if (!escolhido || motivo === '') return
    setEnviando(true)
    setErro(null)
    try {
      await estoqueService.solicitarBaixa({
        produtoId: produto.id,
        remessaId: escolhido.remessaId,
        quantidade: qtd,
        motivo,
        justificativa: justificativa.trim(),
        foto: foto ? { conteudoBase64: await lerComoBase64(foto), tipo: foto.type } : null,
      })
      onConcluido(`Baixa de ${qtd} ${qtd === 1 ? 'unidade' : 'unidades'} de ${produto.nome} enviada para aprovação.`)
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={produto.nome}
      titulo="Solicitar baixa"
      textoConfirmar="Enviar para aprovação"
      confirmarDesabilitado={!quantidadeValida || motivo === '' || !justificativa.trim() || fotoGrande || enviando}
      onFechar={onFechar}
      onConfirmar={() => void enviar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          O estoque só diminui quando o Administrador aprovar. Até lá as unidades continuam vendáveis e aparecem como
          “aguardando baixa”.
        </TextoSuave>
        {detalhe.carregando && <Carregando />}
        {detalhe.erro && (
          <Aviso tipo="error" titulo="Erro">
            {detalhe.erro}
          </Aviso>
        )}
        {detalhe.dados && lotes.every((l) => disponivelParaBaixa(l) === 0) && (
          <Aviso tipo="info" titulo="Sem saldo para baixa">
            Este produto não tem unidades disponíveis para um novo pedido de baixa.
          </Aviso>
        )}
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível enviar">
            {erro}
          </Aviso>
        )}
        <GradeForm>
          {lotes.length > 1 && (
            <TextField select label="Lote" value={lote} onChange={(e) => setLote(e.target.value)}>
              {lotes.map((l) => (
                <MenuItem key={l.remessaId ?? 'proprio'} value={String(l.remessaId ?? 'proprio')} disabled={disponivelParaBaixa(l) === 0}>
                  {rotuloLote(l)} — {disponivelParaBaixa(l)} disponíveis
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Quantidade"
            required
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
            error={quantidade !== '' && !quantidadeValida && escolhido !== null}
            helperText={escolhido ? `Disponível para baixa: ${disponivel}` : ' '}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <TextField select label="Motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoBaixa)}>
            {(Object.keys(ROTULO_MOTIVO_BAIXA) as MotivoBaixa[]).map((m) => (
              <MenuItem key={m} value={m}>
                {ROTULO_MOTIVO_BAIXA[m]}
              </MenuItem>
            ))}
          </TextField>
        </GradeForm>
        {escolhido?.remessaId !== null && escolhido !== null && motivo !== '' && motivo !== 'VENCIMENTO' && (
          <TextoSuave>
            Baixa de consignado por {ROTULO_MOTIVO_BAIXA[motivo].toLowerCase()} gera, na aprovação, uma obrigação com a
            editora pelo repasse da remessa, sem receita.
          </TextoSuave>
        )}
        <TextField
          label="Justificativa"
          required
          multiline
          minRows={2}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
        />
        <div>
          <Typography component="label" variant="body2" htmlFor="foto-baixa" sx={{ display: 'block', mb: 0.5 }}>
            Foto (opcional, JPG ou PNG até 5 MB)
          </Typography>
          <input
            id="foto-baixa"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
          {fotoGrande && (
            <Typography variant="body2" color="error" role="alert">
              A foto deve ter até 5 MB.
            </Typography>
          )}
        </div>
      </Pilha>
    </DialogoAcao>
  )
}
