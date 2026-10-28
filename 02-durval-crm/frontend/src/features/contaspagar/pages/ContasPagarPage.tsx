import AddIcon from '@mui/icons-material/Add'
import {
  Button,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { CampoMes } from '../../../shared/components/CampoMes'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ResultadoOperacao } from '../../financeiro/components/ResultadoOperacao'
import { nomeDoMes } from '../../financeiro/regras'
import { PagarDialogo, type VencimentoAPagar } from '../components/PagarDialogo'
import { SituacaoParcelaTag } from '../components/Tags'
import { contasPagarService } from '../services'
import type { ResultadoPagamentoConta } from '../types'

const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return paraIsoData(new Date(a, m, 0))
}

/**
 * Agenda das contas a pagar: os vencimentos do mês (e os vencidos de antes, se pedido), com o
 * pagamento de cada um, que gera a despesa no Financeiro.
 */
export function ContasPagarPage() {
  const navegar = useNavigate()
  const [mes, setMes] = useState(paraIsoData(hoje()).slice(0, 7))
  const [incluirVencidas, setIncluirVencidas] = useState(true)
  const [pagando, setPagando] = useState<VencimentoAPagar | null>(null)
  const [resultado, setResultado] = useState<ResultadoPagamentoConta | null>(null)
  const parcelas = useCarregamento(
    () => (mes ? contasPagarService.parcelas(`${mes}-01`, ultimoDia(mes), incluirVencidas) : Promise.resolve([])),
    [mes, incluirVencidas],
  )
  const resumo = useCarregamento(() => contasPagarService.resumo(), [resultado])

  const lista = parcelas.dados ?? []
  const totalAberto = lista.filter((p) => p.situacao !== 'PAGA').reduce((s, p) => s + p.valorPrevisto, 0)
  const totalPago = lista.reduce((s, p) => s + (p.pagamento?.valor ?? 0), 0)

  return (
    <Pilha component="section" aria-labelledby="titulo-contas-pagar">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-contas-pagar">Contas a pagar</TituloPagina>
        <LinhaAcoes>
          <Button variant="outlined" onClick={() => navegar('/contas-pagar/cadastro')}>
            Cadastro de contas
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navegar('/contas-pagar/nova')}>
            Nova conta
          </Button>
        </LinhaAcoes>
      </LinhaAcoes>

      {resultado?.lancamentoId && (
        <ResultadoOperacao titulo="Pagamento registrado" resultado={{ id: resultado.lancamentoId, avisos: resultado.avisos }}
          onFechar={() => setResultado(null)} />
      )}

      {resumo.dados && (
        <GradeForm aria-label="Resumo das contas a pagar">
          <Indicador rotulo="Vencidas" valor={String(resumo.dados.vencidas)} destaque={resumo.dados.vencidas > 0 ? 'error' : undefined}
            detalhe={`${formatarMoeda(resumo.dados.valorVencidas)} previstos`} />
          <Indicador rotulo={`Vencem em ${resumo.dados.diasAVencer} dias`} valor={String(resumo.dados.aVencer)}
            destaque={resumo.dados.aVencer > 0 ? 'warning' : undefined} detalhe={`${formatarMoeda(resumo.dados.valorAVencer)} previstos`} />
        </GradeForm>
      )}

      <GradeForm role="search" aria-label="Filtrar vencimentos">
        <CampoMes rotulo="Mês" valor={mes} onAlterar={setMes} />
        <FormControlLabel
          control={<Checkbox checked={incluirVencidas} onChange={(e) => setIncluirVencidas(e.target.checked)} />}
          label="Incluir vencidas de meses anteriores"
        />
      </GradeForm>

      {parcelas.carregando && <Carregando />}
      {parcelas.erro && <Aviso tipo="error" titulo="Erro">{parcelas.erro}</Aviso>}
      {!parcelas.carregando && !parcelas.erro && lista.length === 0 && (
        <TextoSuave>Nenhum vencimento em {mes ? nomeDoMes(mes) : 'o período'}.</TextoSuave>
      )}
      {lista.length > 0 && (
        <>
          <Table size="small" aria-label="Vencimentos">
            <TableHead>
              <TableRow>
                <TableCell>Vencimento</TableCell>
                <TableCell sx={{ minWidth: '10rem' }}>Conta</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Pagamento</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={`${p.contaPagarId}-${p.vencimento}`} hover>
                  <TableCell>{formatarData(p.vencimento)}</TableCell>
                  <TableCell>
                    <LinkRota to={`/contas-pagar/${p.contaPagarId}`}>{p.descricao}</LinkRota>
                    {p.favorecido && (
                      <Typography variant="body2" color="text.secondary">
                        {p.favorecido}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{p.categoriaNome ?? p.categoria}</TableCell>
                  <TableCell align="right">
                    {formatarMoeda(p.pagamento?.valor ?? p.valorPrevisto)}
                    {!p.pagamento && (
                      <Typography variant="caption" component="p" color="text.secondary">
                        previsto
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <SituacaoParcelaTag situacao={p.situacao} />
                  </TableCell>
                  <TableCell>
                    {p.pagamento ? (
                      <>
                        {formatarData(p.pagamento.pagoEm)} · {p.pagamento.contaNome}
                        {p.pagamento.lancamentoId && (
                          <Typography variant="body2">
                            <LinkRota to={`/financeiro/lancamentos/${p.pagamento.lancamentoId}`}>
                              Lançamento nº {p.pagamento.lancamentoId}
                            </LinkRota>
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Button size="small" variant="outlined" aria-label={`Pagar ${p.descricao} de ${formatarData(p.vencimento)}`}
                        onClick={() => setPagando(p)}>
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TextoSuave>
            Em aberto: {formatarMoeda(totalAberto)} previstos · Pago: {formatarMoeda(totalPago)}
          </TextoSuave>
        </>
      )}

      {pagando && (
        <PagarDialogo
          alvo={pagando}
          onFechar={() => setPagando(null)}
          onPago={(r) => {
            setPagando(null)
            setResultado(r)
            parcelas.recarregar()
          }}
        />
      )}
    </Pilha>
  )
}
