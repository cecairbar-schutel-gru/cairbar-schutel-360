import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { mensagemDeErro, salvarArquivo } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { EstornoModal } from '../components/EstornoModal'
import { ReclassificacaoModal } from '../components/ReclassificacaoModal'
import { NaturezaTag, Valor } from '../components/Tags'
import { linkDaOrigem, ROTULO_ORIGEM, ROTULO_TIPO_CONTA } from '../rotulos'
import { financeiroService } from '../services'
import type { DetalheLancamento, ResultadoEstorno } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography variant="subtitle2" component="p" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography component="div">{children}</Typography>
    </div>
  )
}

/**
 * Detalhe do lançamento: linhas de conta e de categoria, vínculos de estorno e correção
 * (US-FINANCIAL-010) e histórico de classificação (US-FINANCIAL-021).
 */
export function LancamentoPage() {
  const { id } = useParams()
  const detalhe = useCarregamento(() => financeiroService.lancamento(Number(id)), [id])
  const [modal, setModal] = useState<'estorno' | 'reclassificacao' | null>(null)
  const [estorno, setEstorno] = useState<ResultadoEstorno | null>(null)
  const [reclassificado, setReclassificado] = useState(false)
  const [erroAnexo, setErroAnexo] = useState<string | null>(null)

  if (detalhe.carregando) return <Carregando linhas={6} />
  if (detalhe.erro || !detalhe.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {detalhe.erro ?? 'Lançamento não encontrado.'}
      </Aviso>
    )
  }
  const l: DetalheLancamento = detalhe.dados
  const origem = linkDaOrigem(l.origemTipo, l.origemId)

  async function baixarAnexo() {
    setErroAnexo(null)
    try {
      salvarArquivo(await financeiroService.baixarAnexo(l.id))
    } catch (e) {
      setErroAnexo(mensagemDeErro(e))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-lancamento">
      <LinkRota to="/financeiro/lancamentos">Voltar aos lançamentos</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-lancamento">Lançamento nº {l.id}</TituloPagina>
        <LinhaAcoes>
          <BotaoHistorico entidade="LancamentoFinanceiro" id={l.id} />
          {l.podeReclassificar && (
            <Button variant="outlined" onClick={() => setModal('reclassificacao')}>
              Reclassificar
            </Button>
          )}
          {l.podeEstornar && (
            <Button variant="outlined" color="error" onClick={() => setModal('estorno')}>
              Estornar
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>

      {estorno && (
        <Aviso tipo="success" titulo="Estorno registrado" onFechar={() => setEstorno(null)}>
          <LinkRota to={`/financeiro/lancamentos/${estorno.estornoId}`}>Ver o estorno nº {estorno.estornoId}</LinkRota>
          {estorno.correcaoId !== null && (
            <>
              {' · '}
              <LinkRota to={`/financeiro/lancamentos/${estorno.correcaoId}`}>Ver o lançamento correto nº {estorno.correcaoId}</LinkRota>
            </>
          )}
        </Aviso>
      )}
      {estorno?.avisos.map((a) => (
        <Aviso key={a} tipo="warning" titulo="Atenção">
          {a}
        </Aviso>
      ))}
      {reclassificado && (
        <Aviso tipo="success" titulo="Lançamento reclassificado" onFechar={() => setReclassificado(false)}>
          A classificação anterior ficou registrada no histórico.
        </Aviso>
      )}
      {l.estornadoPorId !== null && (
        <Aviso tipo="info" titulo="Lançamento estornado">
          Anulado pelo <LinkRota to={`/financeiro/lancamentos/${l.estornadoPorId}`}>estorno nº {l.estornadoPorId}</LinkRota>.
          {l.correcoes.length > 0 && (
            <>
              {' '}Lançamento correto:{' '}
              {l.correcoes.map((c) => (
                <LinkRota key={c} to={`/financeiro/lancamentos/${c}`}>{`nº ${c}`}</LinkRota>
              ))}
              .
            </>
          )}
        </Aviso>
      )}
      {l.estornaLancamentoId !== null && (
        <Aviso tipo="info" titulo="Este lançamento é um estorno">
          Anula o <LinkRota to={`/financeiro/lancamentos/${l.estornaLancamentoId}`}>lançamento nº {l.estornaLancamentoId}</LinkRota>
          {l.motivo && <>. Motivo: {l.motivo}</>}
        </Aviso>
      )}
      {l.corrigeLancamentoId !== null && (
        <Aviso tipo="info" titulo="Lançamento de correção">
          Registrado no lugar do <LinkRota to={`/financeiro/lancamentos/${l.corrigeLancamentoId}`}>lançamento nº {l.corrigeLancamentoId}</LinkRota>.
        </Aviso>
      )}
      {erroAnexo && (
        <Aviso tipo="error" titulo="Erro">
          {erroAnexo}
        </Aviso>
      )}

      <Card variant="outlined">
        <CardContent>
          <GradeForm>
            <Campo rotulo="Data">{formatarData(l.data)}</Campo>
            <Campo rotulo="Descrição">{l.descricao}</Campo>
            <Campo rotulo="Tipo">
              <NaturezaTag natureza={l.natureza} />
            </Campo>
            <Campo rotulo="Valor">
              <Valor valor={l.valor} negrito />
            </Campo>
            <Campo rotulo="Origem">
              {origem ? <LinkRota to={origem}>{ROTULO_ORIGEM[l.origemTipo]}</LinkRota> : ROTULO_ORIGEM[l.origemTipo]}
            </Campo>
            <Campo rotulo="Registrado por">
              {l.usuario} em {formatarDataHora(l.registradoEm)}
            </Campo>
            {l.referenciaExterna && <Campo rotulo="Referência da adquirente">{l.referenciaExterna}</Campo>}
            <Campo rotulo="Conciliação">{l.conciliado ? 'Conciliado' : 'Não conciliado'}</Campo>
            {l.temAnexo && (
              <Campo rotulo="Comprovante">
                <Button size="small" onClick={() => void baixarAnexo()}>
                  Baixar anexo
                </Button>
              </Campo>
            )}
          </GradeForm>
        </CardContent>
      </Card>

      <Typography variant="h6" component="h2">
        Contas
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="Linhas de conta">
          <TableHead>
            <TableRow>
              <TableCell>Conta</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Movimento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {l.linhasConta.map((c) => (
              <TableRow key={c.contaId}>
                <TableCell>
                  <LinkRota to={`/financeiro/lancamentos?contaId=${c.contaId}`}>{c.contaNome}</LinkRota>
                </TableCell>
                <TableCell>{c.tipoConta ? ROTULO_TIPO_CONTA[c.tipoConta] : '—'}</TableCell>
                <TableCell align="right">
                  <Valor valor={c.valor} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" component="h2">
        Classificação
      </Typography>
      {l.linhasCategoria.length === 0 ? (
        <TextoSuave>Sem categoria: transferências e liquidações sem taxa não são receita nem despesa.</TextoSuave>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Linhas de categoria">
            <TableHead>
              <TableRow>
                <TableCell>Categoria</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {l.linhasCategoria.map((c) => (
                <TableRow key={c.ordem}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell align="right">
                    <Valor valor={c.valor} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {l.historico.length > 0 && (
        <>
          <Typography variant="h6" component="h2">
            Histórico de classificação
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Histórico de classificação">
              <TableHead>
                <TableRow>
                  <TableCell>Quando</TableCell>
                  <TableCell>De</TableCell>
                  <TableCell>Para</TableCell>
                  <TableCell>Quem</TableCell>
                  <TableCell>Motivo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {l.historico.map((h) => (
                  <TableRow key={`${h.em}-${h.ordem}`}>
                    <TableCell>{formatarDataHora(h.em)}</TableCell>
                    <TableCell>{h.de}</TableCell>
                    <TableCell>{h.para}</TableCell>
                    <TableCell>{h.por}</TableCell>
                    <TableCell>{h.motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {!l.podeEstornar && l.estornaLancamentoId === null && l.estornadoPorId === null && (l.origemTipo === 'CONTRIBUICAO' || l.origemTipo === 'VENDA') && (
        <TextoSuave>
          {l.origemTipo === 'CONTRIBUICAO' ? 'Contribuições são corrigidas pelo cancelamento da contribuição.' : 'Vendas são corrigidas pelo cancelamento da venda.'}
        </TextoSuave>
      )}

      {modal === 'estorno' && (
        <EstornoModal
          lancamento={l}
          onFechar={() => setModal(null)}
          onConcluido={(r) => {
            setModal(null)
            setEstorno(r)
            detalhe.recarregar()
          }}
        />
      )}
      {modal === 'reclassificacao' && (
        <ReclassificacaoModal
          lancamento={l}
          onFechar={() => setModal(null)}
          onConcluido={() => {
            setModal(null)
            setReclassificado(true)
            detalhe.recarregar()
          }}
        />
      )}
    </Pilha>
  )
}
