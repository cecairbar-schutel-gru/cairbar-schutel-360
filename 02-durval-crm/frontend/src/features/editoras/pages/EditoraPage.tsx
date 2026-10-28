import { Button, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda, formatarTelefone } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { StatusEditoraTag } from '../components/Tags'
import { formatarCnpj } from '../regras'
import { editoraService } from '../services'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

/**
 * Página da editora (US-PUBLISHER-001): dados de contato e pagamento, remessas abertas, saldo devido
 * e último pagamento. Inativa não recebe remessas, mas o saldo continua pagável.
 */
export function EditoraPage() {
  const editoraId = Number(useParams().id)
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const { dados, carregando, erro, recarregar } = useCarregamento(() => editoraService.editora(editoraId), [editoraId])
  const [falha, setFalha] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  if (carregando && !dados) return <Carregando linhas={6} />
  if (erro || !dados) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Editora não encontrada.'}</Aviso>
  const { editora: e } = dados
  const cadastro = possuiPapel('vendedor', 'administrador')
  const tesouraria = possuiPapel('tesoureiro', 'administrador')

  async function executar(acao: () => Promise<unknown>) {
    setFalha(null)
    try {
      await acao()
      recarregar()
    } catch (f) {
      setFalha(mensagemDeErro(f))
    }
  }

  async function excluir() {
    setExcluindo(false)
    setFalha(null)
    try {
      await editoraService.excluir(editoraId)
      navegar('/editoras')
    } catch (f) {
      setFalha(mensagemDeErro(f))
    }
  }

  const pagamento = [e.banco && `Banco ${e.banco}`, e.agencia && `agência ${e.agencia}`, e.conta && `conta ${e.conta}`].filter(Boolean).join(', ')
  return (
    <Pilha component="section" aria-labelledby="titulo-editora">
      <LinkRota to="/editoras">Voltar às editoras</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <LinhaAcoes>
          <TituloPagina id="titulo-editora">{e.nome}</TituloPagina>
          <StatusEditoraTag ativa={e.ativa} />
          <BotaoHistorico entidade="Editora" id={e.id} />
        </LinhaAcoes>
        <LinhaAcoes>
          {tesouraria && (
            <Button variant="outlined" onClick={() => navegar(`/editoras/${e.id}/saldo`)}>
              Saldo devido
            </Button>
          )}
          {tesouraria && (
            <Button variant="outlined" onClick={() => navegar(`/editoras/${e.id}/apuracao`)}>
              Apuração mensal
            </Button>
          )}
          {tesouraria && e.ativa && (
            <Button variant="outlined" onClick={() => navegar(`/editoras/pedidos/novo?editoraId=${e.id}`)}>
              Pedir livros
            </Button>
          )}
          {cadastro && (
            <Button variant="outlined" onClick={() => navegar(`/editoras/${e.id}/editar`)}>
              Alterar
            </Button>
          )}
          {cadastro && e.ativa && (
            <Button variant="contained" onClick={() => navegar(`/editoras/remessas/nova?editoraId=${e.id}`)}>
              Registrar remessa
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>
      {falha && <Aviso tipo="error" titulo="Erro" onFechar={() => setFalha(null)}>{falha}</Aviso>}
      {!e.ativa && (
        <Aviso tipo="info" titulo="Editora inativa">
          Não recebe novas remessas, mas o saldo em aberto ainda pode ser pago.
        </Aviso>
      )}

      <GradeForm>
        {tesouraria && <Indicador rotulo="Saldo devido" valor={formatarMoeda(dados.saldoDevido)} destaque={dados.saldoDevido > 0 ? 'warning' : undefined} />}
        {tesouraria && (
          <Indicador
            rotulo="Último pagamento"
            valor={dados.ultimoPagamento ? formatarMoeda(dados.ultimoPagamento.valor) : '—'}
            detalhe={dados.ultimoPagamento ? `em ${formatarData(dados.ultimoPagamento.data)}` : 'Nenhum pagamento'}
          />
        )}
        <Indicador rotulo="Remessas abertas" valor={String(dados.remessasAbertas.length)} />
      </GradeForm>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Dados da editora
          </Typography>
          <Typography>CNPJ: {formatarCnpj(e.cnpj)}</Typography>
          <Typography>
            Contato: {[e.contatoNome, e.telefone && formatarTelefone(e.telefone), e.email].filter(Boolean).join(' · ') || '—'}
          </Typography>
          <Typography>Pagamento: {[pagamento, e.chavePix && `PIX ${e.chavePix}`].filter(Boolean).join(' · ') || '—'}</Typography>
          {e.observacoes && <TextoSuave>{e.observacoes}</TextoSuave>}
        </CardContent>
      </Card>

      <Typography variant="h6" component="h2">
        Remessas abertas
      </Typography>
      {dados.remessasAbertas.length === 0 ? (
        <TextoSuave>Nenhuma remessa aberta.</TextoSuave>
      ) : (
        <TableContainer>
          <Table size="small" aria-label="Remessas abertas">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Recebida em</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell align="right">Recebidas</TableCell>
                <TableCell align="right">Restantes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.remessasAbertas.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <LinkRota to={`/editoras/remessas/${r.id}`}>{r.codigo}</LinkRota>
                  </TableCell>
                  <TableCell>{formatarData(r.recebidaEm)}</TableCell>
                  <TableCell>{r.numeroDocumento ?? '—'}</TableCell>
                  <TableCell align="right">{r.recebidas}</TableCell>
                  <TableCell align="right">{r.restantes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {cadastro && (
        <LinhaAcoes>
          {e.ativa ? (
            <Button color="warning" onClick={() => void executar(() => editoraService.inativar(e.id))}>
              Inativar editora
            </Button>
          ) : (
            <Button onClick={() => void executar(() => editoraService.reativar(e.id))}>Reativar editora</Button>
          )}
          {!dados.possuiRemessas && (
            <Button color="error" onClick={() => setExcluindo(true)}>
              Excluir editora
            </Button>
          )}
        </LinhaAcoes>
      )}
      <DialogoAcao
        aberto={excluindo}
        titulo="Excluir editora"
        textoConfirmar="Excluir"
        perigo
        onFechar={() => setExcluindo(false)}
        onConfirmar={() => void excluir()}
      >
        <TextoSuave>{e.nome} ainda não tem remessas e será excluída do cadastro.</TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
