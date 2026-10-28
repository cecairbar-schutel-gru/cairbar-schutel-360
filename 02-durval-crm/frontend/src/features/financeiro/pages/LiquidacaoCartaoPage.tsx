import { Button, MenuItem, TextField, Typography } from '@mui/material'
import { useRef, useState, type FormEvent } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, novaChaveIdempotencia, paraReais, ROTULO_TIPO_CARTAO, type TipoCartao } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { ResultadoOperacao } from '../components/ResultadoOperacao'
import { erroLiquidacao, liquidoDaLiquidacao } from '../regras'
import { financeiroService } from '../services'
import type { ResultadoLancamento } from '../types'

const ler = (texto: string) => {
  const c = lerValor(texto)
  return c === null ? null : Number.isNaN(c) ? Number.NaN : paraReais(c)
}

/**
 * Liquidação de cartão (US-FINANCIAL-004): Cartão a receber −bruto, banco +líquido e a taxa como
 * despesa "Taxas de cartão", numa única transação. O saldo a receber aparece dividido em crédito,
 * débito e não informado; o tipo liquidado é opcional, só para conferência (o limite é o total).
 */
export function LiquidacaoCartaoPage() {
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const porTipo = useCarregamento(() => financeiroService.cartaoAReceber(), [])
  const [campos, setCampos] = useState({
    banco: '' as number | '',
    data: paraIsoData(hoje()),
    bruto: '',
    taxa: '',
    tipoCartao: '' as TipoCartao | '',
    referencia: '',
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoLancamento | null>(null)
  const chave = useRef(novaChaveIdempotencia())
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  if (contas.carregando || porTipo.carregando) return <Carregando />
  const lista = contas.dados ?? []
  const cartao = lista.find((c) => c.tipo === 'CARTAO_A_RECEBER')
  const bancos = lista.filter((c) => c.tipo === 'BANCO' && c.ativa)
  const saldoCartao = cartao?.saldo ?? 0
  const bruto = ler(campos.bruto)
  const taxa = ler(campos.taxa)
  const problema = erroLiquidacao(bruto, taxa, saldoCartao)
  const liquido = bruto !== null && taxa !== null && !Number.isNaN(bruto) && !Number.isNaN(taxa) ? liquidoDaLiquidacao(bruto, taxa) : null
  const banco = bancos.find((b) => b.id === campos.banco)

  function validar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!banco) locais.contaBancariaId = 'Escolha a conta bancária que recebeu o depósito.'
    if (!campos.data) locais.data = 'Informe a data da liquidação.'
    if (problema) locais[problema.campo] = problema.mensagem
    setErros(locais)
    if (Object.keys(locais).length === 0) setConfirmando(true)
  }

  async function enviar() {
    setErro(null)
    try {
      const r = await financeiroService.liquidarCartao({
        contaBancariaId: Number(campos.banco),
        data: campos.data,
        bruto: bruto!,
        taxa: taxa!,
        tipoCartao: campos.tipoCartao || null,
        referencia: campos.referencia,
        chaveIdempotencia: chave.current,
      })
      setResultado(r)
      setCampos((c) => ({ ...c, bruto: '', taxa: '', tipoCartao: '', referencia: '' }))
      chave.current = novaChaveIdempotencia()
      contas.recarregar()
      porTipo.recarregar()
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
    }
    setConfirmando(false)
  }

  // Bruto acima do saldo aparece já ao digitar; as demais validações, ao registrar.
  const erroBruto = erros.bruto ?? (problema?.campo === 'bruto' && campos.bruto ? problema.mensagem : undefined)
  return (
    <Pilha component="section" aria-labelledby="titulo-liquidacao">
      <LinkRota to="/financeiro">Voltar ao Financeiro</LinkRota>
      <TituloPagina id="titulo-liquidacao">Liquidação de cartão</TituloPagina>
      <GradeForm>
        <Indicador rotulo="Saldo de Cartão a receber" valor={formatarMoeda(saldoCartao)} destaque="primary" />
        {porTipo.dados && (
          <>
            <Indicador rotulo="Crédito" valor={formatarMoeda(porTipo.dados.credito)} />
            <Indicador rotulo="Débito" valor={formatarMoeda(porTipo.dados.debito)} />
            <Indicador rotulo="Tipo não informado" valor={formatarMoeda(porTipo.dados.naoInformado)} />
          </>
        )}
      </GradeForm>
      {resultado && <ResultadoOperacao titulo="Liquidação registrada" resultado={resultado} onFechar={() => setResultado(null)} />}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível registrar">
          {erro}
        </Aviso>
      )}
      <Pilha component="form" onSubmit={validar} noValidate spacing={2} aria-label="Nova liquidação de cartão">
        <GradeForm>
          <TextField type="date" label="Data da liquidação" required value={campos.data} onChange={(e) => alterar({ data: e.target.value })}
            error={!!erros.data} helperText={erros.data ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
          <TextField select label="Conta bancária de destino" required value={campos.banco}
            onChange={(e) => alterar({ banco: Number(e.target.value) })}
            error={!!erros.contaBancariaId} helperText={erros.contaBancariaId ?? ' '}>
            {bancos.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.nome}
              </MenuItem>
            ))}
          </TextField>
          <CampoValor rotulo="Valor bruto" valor={campos.bruto} onAlterar={(v) => alterar({ bruto: v })} ajuda={erroBruto ?? ' '} />
          <CampoValor rotulo="Taxa" valor={campos.taxa} onAlterar={(v) => alterar({ taxa: v })} ajuda={erros.taxa ?? 'Despesa “Taxas de cartão”; pode ser zero.'} />
          <TextField select label="Tipo liquidado (opcional)" value={campos.tipoCartao}
            onChange={(e) => alterar({ tipoCartao: e.target.value as TipoCartao | '' })}
            helperText={erros.tipoCartao ?? 'Só para conferência; o limite é o saldo total.'} error={!!erros.tipoCartao}>
            <MenuItem value="">Não informar</MenuItem>
            {(Object.keys(ROTULO_TIPO_CARTAO) as TipoCartao[]).map((t) => (
              <MenuItem key={t} value={t}>
                {ROTULO_TIPO_CARTAO[t]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Referência da adquirente (opcional)" value={campos.referencia}
            onChange={(e) => alterar({ referencia: e.target.value })} helperText={erros.referencia ?? 'Número do lote ou da liquidação.'}
            error={!!erros.referencia} />
        </GradeForm>
        <Typography role="status" aria-live="polite">
          Líquido (entra no banco): <strong>{liquido === null ? '—' : formatarMoeda(liquido)}</strong>
        </Typography>
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={saldoCartao <= 0}>
            Registrar liquidação
          </Button>
        </LinhaAcoes>
        {saldoCartao <= 0 && <TextoSuave>Não há valores em Cartão a receber para liquidar.</TextoSuave>}
      </Pilha>
      <DialogoAcao
        aberto={confirmando}
        titulo="Confirmar liquidação"
        textoConfirmar="Confirmar"
        onFechar={() => setConfirmando(false)}
        onConfirmar={() => void enviar()}
      >
        <TextoSuave>
          Em {formatarData(campos.data)}: Cartão a receber{campos.tipoCartao && ` (${ROTULO_TIPO_CARTAO[campos.tipoCartao].toLowerCase()})`} −
          {bruto !== null && formatarMoeda(bruto)}, {banco?.nome} +
          {liquido !== null && formatarMoeda(liquido)} e taxa de {taxa !== null && formatarMoeda(taxa)} como despesa.
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
