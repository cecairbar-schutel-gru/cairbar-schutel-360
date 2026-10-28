import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useRef, useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarCompetencia } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CamposPagamento } from '../../../shared/pagamento/CamposPagamento'
import { contaDoMeio, ERRO_TIPO_CARTAO, rotuloPagamento, VALORES_VAZIOS } from '../../../shared/pagamento/regras'
import {
  mensagemDeFalta,
  mensagemDetalhada,
  novaChaveIdempotencia,
  paraCentavos,
  paraReais,
  resumirPagamento,
  type ValoresDigitados,
} from '../regras'
import { contribuicaoService } from '../services'
import {
  LIMITE_OBSERVACAO,
  type ContribuicaoRegistrada,
  type OpcoesPagamento,
} from '../types'

interface Props {
  /** `null` na doação anônima. */
  doador: { id: number; nome: string } | null
  competencias: { mes: string; valor: number }[]
  onVoltar?(): void
  onRegistrada(registrada: ContribuicaoRegistrada): void
}

/**
 * Passo "Pagamento" (US-CONTRIB-004 e 006): divisão entre dinheiro, PIX e cartão, resumo com a
 * diferença, classificação do excedente e confirmação com revisão.
 */
export function EtapaPagamento({ doador, competencias, onVoltar, onRegistrada }: Props) {
  const opcoes = useCarregamento(() => contribuicaoService.opcoesPagamento(), [])
  if (opcoes.carregando) return <Carregando />
  if (opcoes.erro || !opcoes.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {opcoes.erro ?? 'Não foi possível carregar as contas de recebimento.'}
      </Aviso>
    )
  }
  return (
    <FormularioPagamento
      opcoes={opcoes.dados}
      doador={doador}
      competencias={competencias}
      onVoltar={onVoltar}
      onRegistrada={onRegistrada}
    />
  )
}

function FormularioPagamento({
  opcoes,
  doador,
  competencias,
  onVoltar,
  onRegistrada,
}: Props & { opcoes: OpcoesPagamento }) {
  const anonima = doador === null
  const somenteDoacao = competencias.length === 0
  const [valores, setValores] = useState<ValoresDigitados>(VALORES_VAZIOS)
  const [classificarExcedente, setClassificarExcedente] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [revisando, setRevisando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Uma chave por confirmação: clique duplo ou nova tentativa não duplicam a contribuição.
  const chave = useRef(novaChaveIdempotencia())

  const devido = competencias.reduce((s, c) => s + paraCentavos(c.valor), 0)
  const resumo = resumirPagamento(devido, valores)
  const falta = resumo.diferenca < 0 ? -resumo.diferenca : 0
  // Crédito ou débito já aparece no seletor do cartão; os avisos ficam para os valores.
  const errosDeValor = resumo.erros.filter((m) => m !== ERRO_TIPO_CARTAO)
  const excedente = resumo.diferenca > 0 ? resumo.diferenca : 0
  // Sem competência, todo o valor é doação; com competências, o excedente precisa ser classificado.
  const doacao = somenteDoacao ? resumo.recebido : classificarExcedente ? excedente : 0
  const pendenciaExcedente = !somenteDoacao && excedente > 0 && !classificarExcedente
  const podeConfirmar =
    resumo.erros.length === 0 &&
    resumo.recebido > 0 &&
    falta === 0 &&
    !pendenciaExcedente &&
    observacao.trim().length <= LIMITE_OBSERVACAO

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      const registrada = await contribuicaoService.registrar({
        doadorId: doador?.id ?? null,
        anonima,
        competencias: competencias.map((c) => c.mes),
        valorDoacao: paraReais(doacao),
        pagamentos: resumo.pagamentos,
        observacao: observacao.trim(),
        chaveIdempotencia: chave.current,
      })
      onRegistrada(registrada)
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setRevisando(false)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pilha>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível confirmar" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}
      <CamposPagamento
        valores={valores}
        onAlterar={setValores}
        contas={opcoes}
        rotuloDinheiro="Dinheiro (sem o troco)"
      />

      {(somenteDoacao || anonima) && (
        <TextField
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          error={observacao.trim().length > LIMITE_OBSERVACAO}
          helperText={`${observacao.trim().length}/${LIMITE_OBSERVACAO}${
            anonima ? ' — não escreva dados pessoais.' : ''
          }`}
          placeholder={anonima ? 'Ex.: caixa de ofertas, culto de domingo' : 'Ex.: campanha de Natal'}
        />
      )}

      <Box component="section" aria-labelledby="titulo-resumo">
        <Typography id="titulo-resumo" variant="h6" component="h2">
          Resumo
        </Typography>
        <Table size="small" aria-labelledby="titulo-resumo">
          <TableBody>
            {!anonima && !somenteDoacao && (
              <TableRow>
                <TableCell>Competências selecionadas</TableCell>
                <TableCell align="right">{formatarMoeda(paraReais(devido))}</TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell>Total recebido</TableCell>
              <TableCell align="right">{formatarMoeda(paraReais(resumo.recebido))}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Diferença</TableCell>
              <TableCell align="right">{formatarMoeda(paraReais(resumo.diferenca))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <div aria-live="polite">
        {errosDeValor.map((m) => (
          <Aviso key={m} tipo="error" titulo="Valor inválido">
            {m}
          </Aviso>
        ))}
        {errosDeValor.length === 0 && falta > 0 && resumo.recebido > 0 && (
          <Aviso tipo="error" titulo="Valor insuficiente">
            {mensagemDeFalta(falta)}
          </Aviso>
        )}
        {!somenteDoacao && excedente > 0 && (
          <Aviso tipo="warning" titulo={`Excedente de ${formatarMoeda(paraReais(excedente))}`}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={classificarExcedente}
                  onChange={(e) => setClassificarExcedente(e.target.checked)}
                />
              }
              label={`Classificar ${formatarMoeda(paraReais(excedente))} como doação extraordinária${
                doador ? ` de ${doador.nome}` : ''
              }`}
            />
            {!classificarExcedente && (
              <TextoSuave>Classifique o excedente ou corrija os valores para confirmar.</TextoSuave>
            )}
          </Aviso>
        )}
      </div>

      <LinhaAcoes>
        {onVoltar && <Button onClick={onVoltar}>Voltar</Button>}
        <Button variant="contained" disabled={!podeConfirmar} onClick={() => setRevisando(true)}>
          Revisar e confirmar
        </Button>
      </LinhaAcoes>

      <DialogoAcao
        aberto={revisando}
        rotulo="Confirmar recebimento"
        titulo={doador?.nome ?? 'Doação anônima'}
        textoConfirmar={enviando ? 'Confirmando…' : 'Confirmar recebimento'}
        confirmarDesabilitado={enviando}
        onFechar={() => setRevisando(false)}
        onConfirmar={() => void confirmar()}
      >
        <Table size="small" aria-label="Revisão da contribuição">
          <TableBody>
            {competencias.map((c) => (
              <TableRow key={c.mes}>
                <TableCell>Competência {formatarCompetencia(c.mes)}</TableCell>
                <TableCell align="right">{formatarMoeda(c.valor)}</TableCell>
              </TableRow>
            ))}
            {doacao > 0 && (
              <TableRow>
                <TableCell>{anonima ? 'Doação anônima' : 'Doação extraordinária'}</TableCell>
                <TableCell align="right">{formatarMoeda(paraReais(doacao))}</TableCell>
              </TableRow>
            )}
            {resumo.pagamentos.map((p, i) => (
              <TableRow key={i}>
                <TableCell>
                  {rotuloPagamento(p)} —{' '}
                  {contaDoMeio(opcoes, p.meio)}
                </TableCell>
                <TableCell align="right">{formatarMoeda(p.valor)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <strong>Total</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatarMoeda(paraReais(resumo.recebido))}</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogoAcao>
    </Pilha>
  )
}
