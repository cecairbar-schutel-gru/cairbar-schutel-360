import { Box, Card, CardContent, Chip, LinearProgress, MenuItem, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataDoInstante, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { BotaoImprimir, EstiloImpressao } from '../../editoras/components/Impressao'
import { relatorioService } from '../../relatorios/services'
import { BotaoExportar } from '../../../shared/components/BotaoExportar'
import { deslocarMes } from '../../editoras/regras'
import { Valor } from '../../financeiro/components/Tags'
import { nomeDoMes } from '../../financeiro/regras'
import { formatarPercentual, participacao, totaisDasContas } from '../regras'
import { fechamentoService } from '../services'
import type { DemonstrativoMensal, GrupoComparado, LinhaComparada, Variacao } from '../types'

const Colunas = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(30rem, 1fr))',
  gap: theme.spacing(3),
  alignItems: 'start',
}))

const ROTULO_TIPO = { CAIXA: 'Caixa', BANCO: 'Banco', CARTAO_A_RECEBER: 'Cartão a receber' } as const

/**
 * Demonstrativo consolidado do mês (US-CLOSING-007, wireframe 12 "Prestação de contas mensal") com a
 * comparação ao mês anterior (013). Preliminar antes do fechamento; depois, a versão gravada.
 */
export function DemonstrativoPage() {
  const { mes = '' } = useParams()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const versao = parametros.get('versao') ? Number(parametros.get('versao')) : undefined
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
  const { dados, carregando, erro } = useCarregamento(
    () => (valido ? fechamentoService.demonstrativo(mes, versao) : Promise.reject(new Error('Mês inválido.'))),
    [mes, versao],
  )
  const atual = paraIsoData(hoje()).slice(0, 7)
  const meses = Array.from({ length: 24 }, (_, i) => deslocarMes(atual, -i))
  if (!valido) return <Navigate to={`/fechamento/${atual}/demonstrativo`} replace />

  return (
    <Pilha component="section" aria-labelledby="titulo-demonstrativo">
      <EstiloImpressao />
      <Box data-nao-imprimir>
        <LinkRota to="/fechamento">Voltar ao fechamento mensal</LinkRota>
      </Box>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-demonstrativo">Prestação de contas — {nomeDoMes(mes)}</TituloPagina>
        <LinhaAcoes data-nao-imprimir>
          <TextField
            select
            size="small"
            label="Mês"
            value={meses.includes(mes) ? mes : ''}
            onChange={(e) => navegar(`/fechamento/${e.target.value}/demonstrativo`)}
            sx={{ minWidth: 180 }}
          >
            {meses.map((m) => (
              <MenuItem key={m} value={m}>
                {nomeDoMes(m)}
              </MenuItem>
            ))}
          </TextField>
          {dados && dados.versoes.length > 0 && (
            <TextField
              select
              size="small"
              label="Versão"
              value={versao ?? ''}
              onChange={(e) => setParametros(e.target.value ? { versao: e.target.value } : {}, { replace: true })}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Vigente</MenuItem>
              {dados.versoes.map((v) => (
                <MenuItem key={v.versao} value={String(v.versao)}>
                  Versão {v.versao}
                </MenuItem>
              ))}
            </TextField>
          )}
          <BotaoImprimir />
          <BotaoExportar exportar={(formato) => relatorioService.exportar('demonstrativo', formato, { mes, versao })} />
        </LinhaAcoes>
      </LinhaAcoes>
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && <Conteudo d={dados} />}
    </Pilha>
  )
}

function Conteudo({ d }: { d: DemonstrativoMensal }) {
  const totais = totaisDasContas(d.contas)
  return (
    <>
      <Box>
        <SituacaoDoDemonstrativo d={d} />
      </Box>
      <GradeForm aria-label="Resumo do mês">
        <Indicador rotulo="Saldo inicial" valor={formatarMoeda(totais.saldoInicial)} />
        <Indicador rotulo="Receitas" valor={formatarMoeda(d.totalReceitas.atual)} destaque="success" />
        <Indicador rotulo="Despesas" valor={formatarMoeda(d.totalDespesas.atual)} destaque="error" />
        <Indicador rotulo="Saldo final" valor={formatarMoeda(totais.saldoFinal)} destaque="primary" />
      </GradeForm>

      <Colunas>
        <TabelaCategorias titulo="Receitas por categoria" grupos={d.receitas} total={d.totalReceitas} mesAnterior={d.mesAnterior} />
        <TabelaCategorias titulo="Despesas por categoria" grupos={d.despesas} total={d.totalDespesas} mesAnterior={d.mesAnterior} />
      </Colunas>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Resultado financeiro
          </Typography>
          <Table size="small" aria-label="Resultado financeiro">
            <CabecalhoComparacao primeira="" mesAnterior={d.mesAnterior} />
            <TableBody>
              <LinhaValores rotulo="Receitas" v={d.totalReceitas} />
              <LinhaValores rotulo="Despesas" v={d.totalDespesas} />
              <LinhaValores rotulo="Resultado (receitas − despesas)" v={d.resultado} negrito />
            </TableBody>
          </Table>
          <TextoSuave>Transferências entre contas próprias e obrigações com editoras não entram no resultado.</TextoSuave>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Saldos por conta
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Saldos por conta">
              <TableHead>
                <TableRow>
                  <TableCell>Conta</TableCell>
                  <TableCell align="right">Saldo inicial</TableCell>
                  <TableCell align="right">Entradas</TableCell>
                  <TableCell align="right">Saídas</TableCell>
                  <TableCell align="right">Transferências recebidas</TableCell>
                  <TableCell align="right">Transferências enviadas</TableCell>
                  <TableCell align="right">Saldo final</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.contas.map((c) => (
                  <TableRow key={c.contaId}>
                    <TableCell>
                      {c.nome}
                      <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block' }}>
                        {ROTULO_TIPO[c.tipo]}
                      </Typography>
                    </TableCell>
                    <TableCell align="right"><Valor valor={c.saldoInicial} /></TableCell>
                    <TableCell align="right"><Valor valor={c.entradas} /></TableCell>
                    <TableCell align="right"><Valor valor={c.saidas} /></TableCell>
                    <TableCell align="right"><Valor valor={c.transferenciasEntrada} /></TableCell>
                    <TableCell align="right"><Valor valor={c.transferenciasSaida} /></TableCell>
                    <TableCell align="right"><Valor valor={c.saldoFinal} negrito /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell align="right"><Valor valor={totais.saldoInicial} negrito /></TableCell>
                  <TableCell align="right"><Valor valor={totais.entradas} negrito /></TableCell>
                  <TableCell align="right"><Valor valor={totais.saidas} negrito /></TableCell>
                  <TableCell align="right"><Valor valor={totais.transferenciasEntrada} negrito /></TableCell>
                  <TableCell align="right"><Valor valor={totais.transferenciasSaida} negrito /></TableCell>
                  <TableCell align="right"><Valor valor={totais.saldoFinal} negrito /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Box>
          <TextoSuave>Liquidações de cartão aparecem como transferência de Cartão a receber para o banco; a taxa está nas despesas.</TextoSuave>
        </CardContent>
      </Card>

      <Colunas>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Obrigações com editoras no fim do mês
            </Typography>
            <TextoSuave>Mostradas à parte: não fazem parte do resultado.</TextoSuave>
            {d.editoras.length === 0 ? (
              <TextoSuave>Nenhuma editora com saldo devido.</TextoSuave>
            ) : (
              <Table size="small" aria-label="Obrigações com editoras">
                <TableHead>
                  <TableRow>
                    <TableCell>Editora</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell align="right">Saldo devido</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {d.editoras.map((e) => (
                    <TableRow key={e.editoraId}>
                      <TableCell>{e.nome}</TableCell>
                      <TableCell>{e.transferido ? 'Transferido ao mês seguinte' : 'Em aberto'}</TableCell>
                      <TableCell align="right"><Valor valor={e.saldo} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell align="right"><Valor valor={d.totalEditoras} negrito /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Mensalidades
            </Typography>
            <Table size="small" aria-label="Mensalidades">
              <TableHead>
                <TableRow>
                  <TableCell>Competências de {nomeDoMes(d.mes)}</TableCell>
                  <TableCell align="right">Quantidade</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Geradas</TableCell>
                  <TableCell align="right">{d.mensalidades.geradas}</TableCell>
                  <TableCell align="right"><Valor valor={d.mensalidades.valorGerado} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Pagas</TableCell>
                  <TableCell align="right">{d.mensalidades.pagas}</TableCell>
                  <TableCell align="right"><Valor valor={d.mensalidades.valorPago} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Pendentes</TableCell>
                  <TableCell align="right">{d.mensalidades.pendentes}</TableCell>
                  <TableCell align="right"><Valor valor={d.mensalidades.valorPendente} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography sx={{ mt: 1 }}>
              Recebido no mês em mensalidades (de qualquer competência): <strong>{formatarMoeda(d.recebidoMensalidades)}</strong>
            </Typography>
          </CardContent>
        </Card>
      </Colunas>

      <TextoSuave>
        Relatório com valores agregados, em regime de caixa (pela data do recebimento ou pagamento). Transações individuais
        estão em <LinkRota to="/financeiro/lancamentos">Lançamentos</LinkRota>. Comparação com {nomeDoMes(d.mesAnterior)}
        {d.anteriorFechado ? ' (versão fechada)' : ' (preliminar)'}; em destaque, variações acima de 20% e de R$ 100,00.
      </TextoSuave>
    </>
  )
}

function SituacaoDoDemonstrativo({ d }: { d: DemonstrativoMensal }) {
  if (d.situacao === 'PRELIMINAR') {
    return <Chip color="warning" variant="outlined" label="Preliminar: os números ainda podem mudar até o fechamento" />
  }
  const autor = d.fechamento
  return (
    <LinhaAcoes>
      <Chip
        color="success"
        variant="outlined"
        label={`Fechado em ${formatarDataDoInstante(autor?.em)} por ${autor?.nome ?? autor?.subject ?? '—'} · versão ${d.versao}`}
      />
      {!d.versaoVigente && <Chip color="default" variant="outlined" label="Versão substituída por um fechamento posterior" />}
    </LinhaAcoes>
  )
}

function CabecalhoComparacao({ primeira, mesAnterior }: { primeira: string; mesAnterior: string }) {
  return (
    <TableHead>
      <TableRow>
        <TableCell>{primeira}</TableCell>
        <TableCell align="right">Mês</TableCell>
        <TableCell align="right">{nomeDoMes(mesAnterior)}</TableCell>
        <TableCell align="right">Diferença</TableCell>
        <TableCell align="right">%</TableCell>
      </TableRow>
    </TableHead>
  )
}

function TabelaCategorias({
  titulo,
  grupos,
  total,
  mesAnterior,
}: {
  titulo: string
  grupos: GrupoComparado[]
  total: Variacao
  mesAnterior: string
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {titulo}
        </Typography>
        {grupos.length === 0 ? (
          <TextoSuave>Nada no mês nem no anterior.</TextoSuave>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label={titulo}>
              <CabecalhoComparacao primeira="Categoria" mesAnterior={mesAnterior} />
              <TableBody>
                {grupos.map((g) => (
                  <Grupo key={g.codigo} grupo={g} total={total.atual} />
                ))}
              </TableBody>
              <TableFooter>
                <LinhaValores rotulo="Total" v={total} negrito />
              </TableFooter>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function Grupo({ grupo, total }: { grupo: GrupoComparado; total: number }) {
  const parte = participacao(grupo.valores.atual, total)
  return (
    <>
      <LinhaValores
        rotulo={grupo.nome}
        v={grupo.valores}
        negrito
        barra={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LinearProgress variant="determinate" value={parte} sx={{ flexGrow: 1, height: 6, borderRadius: 1 }} aria-hidden />
            <Typography variant="caption" color="text.secondary">
              {parte}%
            </Typography>
          </Box>
        }
      />
      {grupo.subcategorias.map((s: LinhaComparada) => (
        <LinhaValores key={s.codigo} rotulo={s.nome} v={s.valores} recuo />
      ))}
    </>
  )
}

function LinhaValores({
  rotulo,
  v,
  negrito,
  recuo,
  barra,
}: {
  rotulo: string
  v: Variacao
  negrito?: boolean
  recuo?: boolean
  barra?: ReactNode
}) {
  return (
    <TableRow sx={v.destaque ? (t) => ({ bgcolor: alpha(t.palette.warning.main, 0.12) }) : undefined}>
      <TableCell sx={{ pl: recuo ? 4 : undefined, fontWeight: negrito ? 600 : undefined }}>
        {rotulo}
        {v.destaque && (
          <Typography variant="caption" component="span" color="warning.dark" sx={{ display: 'block' }}>
            Variação relevante
          </Typography>
        )}
        {barra}
      </TableCell>
      <TableCell align="right"><Valor valor={v.atual} negrito={negrito} /></TableCell>
      <TableCell align="right"><Valor valor={v.anterior} /></TableCell>
      <TableCell align="right"><Valor valor={v.diferenca} /></TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatarPercentual(v)}</TableCell>
    </TableRow>
  )
}
