import { MenuItem, TextField } from '@mui/material'
import { useRef, useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, novaChaveIdempotencia, paraCentavos, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { financeiroService } from '../../financeiro/services'
import { contasPagarService } from '../services'
import type { ResultadoPagamentoConta } from '../types'

export interface VencimentoAPagar {
  contaPagarId: number
  descricao: string
  vencimento: string
  valorPrevisto: number
  contaFinanceiraId: number | null
}

interface Props {
  alvo: VencimentoAPagar
  onFechar(): void
  onPago(resultado: ResultadoPagamentoConta): void
}

/**
 * Pagamento de um vencimento: o valor do dia (sugerido o previsto), a data e a conta de onde sai.
 * Gera a despesa no Financeiro; correções são feitas por estorno do lançamento.
 */
export function PagarDialogo({ alvo, onFechar, onPago }: Props) {
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const [campos, setCampos] = useState({
    pagoEm: paraIsoData(hoje()),
    valor: paraTextoDigitado(paraCentavos(alvo.valorPrevisto)),
    conta: (alvo.contaFinanceiraId ?? '') as number | '',
    observacao: '',
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const chave = useRef(novaChaveIdempotencia())
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  const disponiveis = (contas.dados ?? []).filter((c) => c.ativa && c.tipo !== 'CARTAO_A_RECEBER')
  const centavos = lerValor(campos.valor)
  const valor = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)

  async function confirmar() {
    const locais: Record<string, string> = {}
    if (!campos.pagoEm) locais.pagoEm = 'Informe a data do pagamento.'
    if (valor === null || valor <= 0) locais.valor = 'Informe um valor maior que zero.'
    if (!campos.conta) locais.contaId = 'Escolha a conta de onde sai o pagamento.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setErro(null)
    setEnviando(true)
    try {
      const r = await contasPagarService.pagar({
        contaPagarId: alvo.contaPagarId,
        vencimento: alvo.vencimento,
        pagoEm: campos.pagoEm,
        valor: valor!,
        contaId: Number(campos.conta),
        observacao: campos.observacao,
        chaveIdempotencia: chave.current,
      })
      onPago(r)
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
      chave.current = novaChaveIdempotencia()
    }
    setEnviando(false)
  }

  return (
    <DialogoAcao
      aberto
      rotulo={`Vencimento ${formatarData(alvo.vencimento)}`}
      titulo={`Pagar ${alvo.descricao}`}
      textoConfirmar="Registrar pagamento"
      confirmarDesabilitado={enviando || contas.carregando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível pagar">
            {erro}
          </Aviso>
        )}
        <TextField type="date" label="Pago em" required value={campos.pagoEm} onChange={(e) => alterar({ pagoEm: e.target.value })}
          error={!!erros.pagoEm} helperText={erros.pagoEm ?? ' '}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
        <CampoValor rotulo="Valor pago" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })}
          ajuda={erros.valor ?? `Previsto: ${formatarMoeda(alvo.valorPrevisto)}`} />
        <TextField select label="Sai da conta" required value={campos.conta} onChange={(e) => alterar({ conta: Number(e.target.value) })}
          error={!!erros.contaId} helperText={erros.contaId ?? ' '}>
          {disponiveis.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.nome}
              {c.saldo !== null && ` — saldo ${formatarMoeda(c.saldo)}`}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Observação (opcional)" value={campos.observacao} onChange={(e) => alterar({ observacao: e.target.value })}
          error={!!erros.observacao} helperText={erros.observacao ?? ' '} slotProps={{ htmlInput: { maxLength: 500 } }} />
        <TextoSuave>A despesa entra no Financeiro e não pode ser editada; correções são feitas por estorno do lançamento.</TextoSuave>
      </Pilha>
    </DialogoAcao>
  )
}
