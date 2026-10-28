import { Button, MenuItem, TextField } from '@mui/material'
import { useRef, useState, type FormEvent } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, novaChaveIdempotencia, paraReais } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { ResultadoOperacao } from '../components/ResultadoOperacao'
import { financeiroService } from '../services'
import type { ContaFinanceira, ResultadoLancamento } from '../types'

const VAZIO = { origem: '' as number | '', destino: '' as number | '', valor: '', data: '', descricao: '' }

/**
 * Transferência interna (US-FINANCIAL-003): caixa ↔ banco e banco ↔ banco. Não é receita nem
 * despesa; Cartão a receber não entra (só sai pela liquidação).
 */
export function TransferenciaPage() {
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const [campos, setCampos] = useState({ ...VAZIO, data: paraIsoData(hoje()) })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoLancamento | null>(null)
  const chave = useRef(novaChaveIdempotencia())
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  if (contas.carregando) return <Carregando />
  const disponiveis = (contas.dados ?? []).filter((c) => c.ativa && c.tipo !== 'CARTAO_A_RECEBER')
  const origem = disponiveis.find((c) => c.id === campos.origem)
  const destino = disponiveis.find((c) => c.id === campos.destino)
  const centavos = lerValor(campos.valor)
  const valor = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)

  function validar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!origem) locais.contaOrigemId = 'Escolha a conta de origem.'
    if (!destino) locais.contaDestinoId = 'Escolha a conta de destino.'
    else if (origem && origem.id === destino.id) locais.contaDestinoId = 'Escolha uma conta de destino diferente da origem.'
    if (valor === null || valor <= 0) locais.valor = 'Informe um valor maior que zero.'
    else if (origem?.tipo === 'CAIXA' && valor > (origem.saldo ?? 0)) {
      locais.valor = `O saldo de ${origem.nome} é ${formatarMoeda(origem.saldo ?? 0)}: o caixa não pode ficar negativo.`
    }
    if (!campos.data) locais.data = 'Informe a data.'
    setErros(locais)
    if (Object.keys(locais).length === 0) setConfirmando(true)
  }

  async function enviar() {
    setErro(null)
    try {
      const r = await financeiroService.transferir({
        contaOrigemId: Number(campos.origem),
        contaDestinoId: Number(campos.destino),
        valor: valor!,
        data: campos.data,
        descricao: campos.descricao,
        chaveIdempotencia: chave.current,
      })
      setResultado(r)
      setCampos({ ...VAZIO, data: campos.data })
      chave.current = novaChaveIdempotencia()
      contas.recarregar()
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
    }
    setConfirmando(false)
  }

  const opcao = (c: ContaFinanceira) => (
    <MenuItem key={c.id} value={c.id}>
      {c.nome} — saldo {formatarMoeda(c.saldo ?? 0)}
    </MenuItem>
  )
  return (
    <Pilha component="section" aria-labelledby="titulo-transferencia">
      <LinkRota to="/financeiro">Voltar ao Financeiro</LinkRota>
      <TituloPagina id="titulo-transferencia">Transferência entre contas</TituloPagina>
      <TextoSuave>Ex.: depósito do dinheiro do caixa no banco. Não é receita nem despesa e aparece no extrato das duas contas.</TextoSuave>
      {resultado && <ResultadoOperacao titulo="Transferência registrada" resultado={resultado} onFechar={() => setResultado(null)} />}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível registrar">
          {erro}
        </Aviso>
      )}
      {contas.erro && (
        <Aviso tipo="error" titulo="Erro">
          {contas.erro}
        </Aviso>
      )}
      <Pilha component="form" onSubmit={validar} noValidate spacing={2} aria-label="Nova transferência">
        <GradeForm>
          <TextField select label="De (origem)" required value={campos.origem}
            onChange={(e) => alterar({ origem: Number(e.target.value) })}
            error={!!erros.contaOrigemId} helperText={erros.contaOrigemId ?? ' '}>
            {disponiveis.map(opcao)}
          </TextField>
          <TextField select label="Para (destino)" required value={campos.destino}
            onChange={(e) => alterar({ destino: Number(e.target.value) })}
            error={!!erros.contaDestinoId} helperText={erros.contaDestinoId ?? ' '}>
            {disponiveis.filter((c) => c.id !== campos.origem).map(opcao)}
          </TextField>
          <CampoValor rotulo="Valor" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })} ajuda={erros.valor ?? ' '} />
          <TextField type="date" label="Data" required value={campos.data} onChange={(e) => alterar({ data: e.target.value })}
            error={!!erros.data} helperText={erros.data ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
          <TextField label="Descrição (opcional)" value={campos.descricao} onChange={(e) => alterar({ descricao: e.target.value })}
            helperText={erros.descricao ?? 'Sem descrição: “Transferência de origem para destino”.'} error={!!erros.descricao} />
        </GradeForm>
        <LinhaAcoes>
          <Button type="submit" variant="contained">
            Registrar transferência
          </Button>
        </LinhaAcoes>
      </Pilha>
      <DialogoAcao
        aberto={confirmando}
        titulo="Confirmar transferência"
        textoConfirmar="Confirmar"
        onFechar={() => setConfirmando(false)}
        onConfirmar={() => void enviar()}
      >
        <TextoSuave>
          {valor !== null && formatarMoeda(valor)} de {origem?.nome} para {destino?.nome} em {formatarData(campos.data)}.
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
