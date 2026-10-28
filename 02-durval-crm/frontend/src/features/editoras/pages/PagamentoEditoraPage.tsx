import { Button, MenuItem, TextField, Typography } from '@mui/material'
import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, novaChaveIdempotencia, paraReais } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { financeiroService } from '../../financeiro/services'
import { TabelaAlocacao } from '../components/TabelaAlocacao'
import { ROTULO_MEIO } from '../rotulos'
import { editoraService } from '../services'
import type { MeioPagamentoEditora, ResultadoPagamento } from '../types'

const MEIOS: MeioPagamentoEditora[] = ['PIX', 'TRANSFERENCIA', 'DINHEIRO']

/**
 * Pagamento a editora, parcial ou total (US-PUBLISHER-008, só Tesoureiro): o valor vai para as
 * obrigações da mais antiga para a mais nova, e a alocação aparece antes de confirmar. Gera a
 * despesa "Despesas comerciais › Repasse às editoras" na data do pagamento, saindo da conta escolhida.
 */
export function PagamentoEditoraPage() {
  const [parametros] = useSearchParams()
  const [editoraId, setEditoraId] = useState<number | ''>(Number(parametros.get('editoraId')) || '')
  const [pagoEm, setPagoEm] = useState(paraIsoData(hoje()))
  const [valorTexto, setValorTexto] = useState('')
  const [meio, setMeio] = useState<MeioPagamentoEditora>('PIX')
  const [contaId, setContaId] = useState<number | ''>('')
  const [observacao, setObservacao] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoPagamento | null>(null)
  const chave = useRef(novaChaveIdempotencia())

  const saldos = useCarregamento(() => editoraService.saldos(), [resultado])
  const contas = useCarregamento(() => financeiroService.contas(), [resultado])
  const centavos = lerValor(valorTexto)
  const valor = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)
  const valorPrevia = useDebounce(valor)
  const previa = useCarregamento(
    () => (editoraId && valorPrevia && valorPrevia > 0 ? editoraService.previa(editoraId, valorPrevia) : Promise.resolve(null)),
    [editoraId, valorPrevia, resultado],
  )

  if (saldos.carregando && !saldos.dados) return <Carregando />
  const editoras = (saldos.dados?.editoras ?? []).filter((e) => e.saldoDevido > 0 || e.editoraId === editoraId)
  const editora = editoras.find((e) => e.editoraId === editoraId)
  const contasDoMeio = (contas.dados ?? []).filter((c) => c.ativa && c.tipo === (meio === 'DINHEIRO' ? 'CAIXA' : 'BANCO'))
  const conta = contasDoMeio.find((c) => c.id === contaId)

  function validar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!editora) locais.editoraId = 'Escolha a editora.'
    if (valor === null || valor <= 0) locais.valor = 'Informe um valor maior que zero.'
    else if (editora && valor > editora.saldoDevido) locais.valor = `O valor passa o saldo devido de ${formatarMoeda(editora.saldoDevido)}.`
    if (!conta) locais.contaId = 'Escolha a conta de origem.'
    else if (meio === 'DINHEIRO' && valor !== null && valor > (conta.saldo ?? 0)) {
      locais.valor = `O saldo de ${conta.nome} é ${formatarMoeda(conta.saldo ?? 0)}: o caixa não pode ficar negativo.`
    }
    if (!pagoEm) locais.pagoEm = 'Informe a data do pagamento.'
    setErros(locais)
    if (Object.keys(locais).length === 0) setConfirmando(true)
  }

  async function enviar() {
    setConfirmando(false)
    setErro(null)
    try {
      const r = await editoraService.pagar({
        editoraId: Number(editoraId),
        pagoEm,
        valor: valor!,
        contaId: Number(contaId),
        meio,
        observacao,
        chaveIdempotencia: chave.current,
      })
      chave.current = novaChaveIdempotencia()
      setValorTexto('')
      setObservacao('')
      setResultado(r)
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
    }
  }

  const p = previa.dados
  return (
    <Pilha component="section" aria-labelledby="titulo-pagar-editora">
      <LinkRota to="/editoras/saldos">Voltar aos saldos</LinkRota>
      <TituloPagina id="titulo-pagar-editora">Pagar editora</TituloPagina>
      <TextoSuave>
        O pagamento pode ser parcial. Ele cobre as obrigações da mais antiga para a mais nova e gera a despesa “Repasse às
        editoras” na data do pagamento. Para corrigir, estorne a despesa no Financeiro: as obrigações voltam a ficar em aberto.
      </TextoSuave>
      {resultado && (
        <>
          <Aviso tipo="success" titulo="Pagamento registrado" onFechar={() => setResultado(null)}>
            <LinkRota to={`/editoras/pagamentos/${resultado.id}`}>Ver e imprimir o recibo nº {resultado.id}</LinkRota>
            {resultado.lancamentoId && (
              <>
                {' · '}
                <LinkRota to={`/financeiro/lancamentos/${resultado.lancamentoId}`}>despesa nº {resultado.lancamentoId}</LinkRota>
              </>
            )}
          </Aviso>
          {resultado.avisos.map((a) => (
            <Aviso key={a} tipo="warning" titulo="Atenção">
              {a}
            </Aviso>
          ))}
        </>
      )}
      {erro && <Aviso tipo="error" titulo="Não foi possível registrar">{erro}</Aviso>}
      {saldos.erro && <Aviso tipo="error" titulo="Erro">{saldos.erro}</Aviso>}
      <Pilha component="form" onSubmit={validar} noValidate spacing={2} aria-label="Novo pagamento a editora">
        <GradeForm>
          <TextField select label="Editora" required value={editoraId} onChange={(e) => setEditoraId(Number(e.target.value))}
            error={!!erros.editoraId} helperText={erros.editoraId ?? (editora ? `Saldo devido: ${formatarMoeda(editora.saldoDevido)}` : ' ')}>
            {editoras.map((e) => (
              <MenuItem key={e.editoraId} value={e.editoraId}>
                {e.nome} — {formatarMoeda(e.saldoDevido)}
              </MenuItem>
            ))}
          </TextField>
          <CampoValor rotulo="Valor" valor={valorTexto} onAlterar={setValorTexto} ajuda={erros.valor ?? ' '} />
          <TextField type="date" label="Data do pagamento" required value={pagoEm} onChange={(e) => setPagoEm(e.target.value)}
            error={!!erros.pagoEm} helperText={erros.pagoEm ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
          <TextField select label="Meio" required value={meio} onChange={(e) => { setMeio(e.target.value as MeioPagamentoEditora); setContaId('') }}
            helperText={erros.meio ?? ' '} error={!!erros.meio}>
            {MEIOS.map((m) => (
              <MenuItem key={m} value={m}>
                {ROTULO_MEIO[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Conta de origem" required value={contaId} onChange={(e) => setContaId(Number(e.target.value))}
            error={!!erros.contaId} helperText={erros.contaId ?? (meio === 'DINHEIRO' ? 'Dinheiro sai de um caixa.' : 'PIX e transferência saem de uma conta bancária.')}>
            {contasDoMeio.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome} — saldo {formatarMoeda(c.saldo ?? 0)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)}
            error={!!erros.observacao} helperText={erros.observacao ?? ' '} slotProps={{ htmlInput: { maxLength: 500 } }} />
        </GradeForm>

        {p && p.alocacoes.length > 0 && (
          <Pilha spacing={1}>
            <Typography variant="h6" component="h2">
              Como o pagamento será distribuído
            </Typography>
            {p.creditoAplicado > 0 && (
              <TextoSuave>Crédito da editora aplicado antes: {formatarMoeda(p.creditoAplicado)} (sem sair dinheiro).</TextoSuave>
            )}
            <TabelaAlocacao alocacoes={p.alocacoes} rotulo="Distribuição do pagamento" />
            <Typography>Saldo devido depois do pagamento: {formatarMoeda(p.saldoDepois)}</Typography>
          </Pilha>
        )}
        <LinhaAcoes>
          <Button type="submit" variant="contained">
            Registrar pagamento
          </Button>
        </LinhaAcoes>
      </Pilha>
      <DialogoAcao
        aberto={confirmando}
        titulo="Confirmar pagamento"
        textoConfirmar="Confirmar"
        onFechar={() => setConfirmando(false)}
        onConfirmar={() => void enviar()}
      >
        <TextoSuave>
          {valor !== null && formatarMoeda(valor)} para {editora?.nome} em {formatarData(pagoEm)}, por {ROTULO_MEIO[meio]} de {conta?.nome}.
          {p && ` Saldo devido depois: ${formatarMoeda(p.saldoDepois)}.`}
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
