import {
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ResultadoOperacao } from '../../financeiro/components/ResultadoOperacao'
import { PagarDialogo } from '../components/PagarDialogo'
import { StatusContaPagarTag } from '../components/Tags'
import { ROTULO_RECORRENCIA } from '../rotulos'
import { contasPagarService } from '../services'
import type { ResultadoPagamentoConta } from '../types'

type Acao = 'encerrar' | 'excluir'

/** Detalhe da conta a pagar: vencimentos em aberto, histórico de pagamentos e ações do cadastro. */
export function ContaPagarPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const detalhe = useCarregamento(() => contasPagarService.conta(Number(id)), [id])
  const [pagando, setPagando] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoPagamentoConta | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  if (detalhe.carregando) return <Carregando />
  if (detalhe.erro || !detalhe.dados) return <Aviso tipo="error" titulo="Erro">{detalhe.erro ?? 'Conta não encontrada.'}</Aviso>
  const { conta: c, categoriaNome, emAberto, pagamentos, quitada } = detalhe.dados
  const hojeIso = paraIsoData(hoje())

  async function executar(fazer: () => Promise<unknown>, depois?: () => void) {
    setErro(null)
    try {
      await fazer()
      if (depois) depois()
      else detalhe.recarregar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    }
    setAcao(null)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-conta-pagar">
      <LinkRota to="/contas-pagar">Voltar às contas a pagar</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <LinhaAcoes>
          <TituloPagina id="titulo-conta-pagar">{c.descricao}</TituloPagina>
          <StatusContaPagarTag ativa={c.ativa} quitada={quitada} />
        </LinhaAcoes>
        <LinhaAcoes>
          {c.ativa ? (
            <>
              <Button variant="outlined" onClick={() => navegar(`/contas-pagar/${c.id}/editar`)}>
                Editar
              </Button>
              <Button variant="outlined" onClick={() => setAcao('encerrar')}>
                Encerrar
              </Button>
            </>
          ) : (
            !quitada && (
              <Button variant="outlined" onClick={() => void executar(() => contasPagarService.reativar(c.id))}>
                Reativar
              </Button>
            )
          )}
          {pagamentos.length === 0 && (
            <Button variant="outlined" color="error" onClick={() => setAcao('excluir')}>
              Excluir
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>

      {erro && <Aviso tipo="error" titulo="Não foi possível concluir">{erro}</Aviso>}
      {resultado?.lancamentoId && (
        <ResultadoOperacao titulo="Pagamento registrado" resultado={{ id: resultado.lancamentoId, avisos: resultado.avisos }}
          onFechar={() => setResultado(null)} />
      )}

      <Card variant="outlined">
        <CardContent>
          <GradeForm>
            <Dado rotulo="Favorecido" valor={c.favorecido ?? '—'} />
            <Dado rotulo="Categoria" valor={categoriaNome ?? c.categoria} />
            <Dado rotulo="Valor previsto" valor={formatarMoeda(c.valorPrevisto)} />
            <Dado rotulo="Recorrência" valor={ROTULO_RECORRENCIA[c.recorrencia]} />
            <Dado rotulo={c.recorrencia === 'UNICA' ? 'Vencimento' : 'Primeiro vencimento'} valor={formatarData(c.primeiroVencimento)} />
            {c.recorrencia !== 'UNICA' && <Dado rotulo="Último vencimento" valor={c.fimRecorrencia ? formatarData(c.fimRecorrencia) : 'Sem fim'} />}
          </GradeForm>
          {c.observacoes && <TextoSuave>{c.observacoes}</TextoSuave>}
        </CardContent>
      </Card>

      <Typography variant="h6" component="h2">
        Vencimentos em aberto
      </Typography>
      {quitada && (
        <TextoSuave>Conta quitada: o vencimento foi pago. Se a despesa for estornada no Financeiro, ela volta a ficar em aberto.</TextoSuave>
      )}
      {!c.ativa && !quitada && <TextoSuave>Conta encerrada: não há vencimentos em aberto.</TextoSuave>}
      {c.ativa && emAberto.length === 0 && <TextoSuave>Nenhum vencimento em aberto.</TextoSuave>}
      {emAberto.length > 0 && (
        <List dense aria-label="Vencimentos em aberto">
          {emAberto.map((v) => (
            <ListItem
              key={v}
              disableGutters
              secondaryAction={
                <Button size="small" variant="outlined" aria-label={`Pagar vencimento de ${formatarData(v)}`} onClick={() => setPagando(v)}>
                  Pagar
                </Button>
              }
            >
              <ListItemText
                primary={formatarData(v)}
                secondary={v < hojeIso ? 'Vencida' : undefined}
                slotProps={{ secondary: { color: 'error.dark' } }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="h6" component="h2">
        Pagamentos
      </Typography>
      {pagamentos.length === 0 ? (
        <TextoSuave>Nenhum pagamento registrado.</TextoSuave>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Pagamentos">
            <TableHead>
              <TableRow>
                <TableCell>Vencimento</TableCell>
                <TableCell>Pago em</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Conta</TableCell>
                <TableCell>Lançamento</TableCell>
                <TableCell>Registrado por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagamentos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatarData(p.vencimento)}</TableCell>
                  <TableCell>{formatarData(p.pagoEm)}</TableCell>
                  <TableCell align="right">{formatarMoeda(p.valor)}</TableCell>
                  <TableCell>{p.contaNome}</TableCell>
                  <TableCell>
                    {p.lancamentoId && <LinkRota to={`/financeiro/lancamentos/${p.lancamentoId}`}>nº {p.lancamentoId}</LinkRota>}
                    {p.estornadoEm && (
                      <Typography variant="body2" color="error.dark">
                        Estornado em {formatarDataHora(p.estornadoEm)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{p.registradoPor ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagando && (
        <PagarDialogo
          alvo={{ contaPagarId: c.id, descricao: c.descricao, vencimento: pagando, valorPrevisto: c.valorPrevisto, contaFinanceiraId: c.contaFinanceiraId }}
          onFechar={() => setPagando(null)}
          onPago={(r) => {
            setPagando(null)
            setResultado(r)
            detalhe.recarregar()
          }}
        />
      )}
      <DialogoAcao
        aberto={acao === 'encerrar'}
        titulo={`Encerrar ${c.descricao}?`}
        textoConfirmar="Encerrar"
        onFechar={() => setAcao(null)}
        onConfirmar={() => void executar(() => contasPagarService.encerrar(c.id))}
      >
        <TextoSuave>
          Os vencimentos em aberto deixam de aparecer na agenda; os pagamentos continuam no histórico. A conta pode ser
          reativada depois.
        </TextoSuave>
      </DialogoAcao>
      <DialogoAcao
        aberto={acao === 'excluir'}
        titulo={`Excluir ${c.descricao}?`}
        textoConfirmar="Excluir"
        perigo
        onFechar={() => setAcao(null)}
        onConfirmar={() => void executar(() => contasPagarService.excluir(c.id), () => navegar('/contas-pagar/cadastro'))}
      >
        <TextoSuave>A conta ainda não tem pagamentos e será removida do cadastro.</TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <Typography variant="subtitle2" component="p" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography>{valor}</Typography>
    </div>
  )
}
