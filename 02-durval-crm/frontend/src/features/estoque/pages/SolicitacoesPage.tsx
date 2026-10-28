import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { DescricaoSolicitacao } from '../components/DescricaoSolicitacao'
import { ModalMotivo } from '../components/ModalMotivo'
import { StatusSolicitacaoTag } from '../components/Tags'
import { ROTULO_TIPO_SOLICITACAO } from '../rotulos'
import { estoqueService } from '../services'
import type { ResumoSolicitacao } from '../types'

function FotoDialogo({ solicitacao, onFechar }: { solicitacao: ResumoSolicitacao; onFechar(): void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let endereco: string | null = null
    estoqueService.baixarFoto(solicitacao.id).then(
      (arquivo) => {
        endereco = URL.createObjectURL(arquivo.conteudo)
        setUrl(endereco)
      },
      (e) => setErro(mensagemDetalhada(e)),
    )
    return () => {
      if (endereco) URL.revokeObjectURL(endereco)
    }
  }, [solicitacao.id])
  return (
    <Dialog open onClose={onFechar} maxWidth="md" aria-labelledby="titulo-foto">
      <DialogTitle id="titulo-foto">Foto do pedido nº {solicitacao.id}</DialogTitle>
      <DialogContent>
        {erro && (
          <Aviso tipo="error" titulo="Erro">
            {erro}
          </Aviso>
        )}
        {!url && !erro && <Carregando linhas={1} />}
        {url && (
          <Box component="img" src={url} alt={`Foto de ${solicitacao.produtoNome}`} sx={{ maxWidth: '100%', display: 'block' }} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Fila de aprovações do Administrador (US-INVENTORY-008/012/015, US-ADMIN-021) ou "Minhas
 * solicitações" do Vendedor, que pode cancelar as pendentes.
 */
export function SolicitacoesPage() {
  const { perfilAtivo, possuiPapel } = useAuth()
  const fila = perfilAtivo === 'administrador' || (possuiPapel('administrador') && !possuiPapel('vendedor'))
  const [aba, setAba] = useState<'PENDENTE' | 'TODAS'>('PENDENTE')
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [rejeitando, setRejeitando] = useState<ResumoSolicitacao | null>(null)
  const [foto, setFoto] = useState<ResumoSolicitacao | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const lista = useCarregamento(
    () => estoqueService.solicitacoes({ status: aba === 'PENDENTE' ? 'PENDENTE' : undefined, minhas: !fila }),
    [aba, fila],
  )

  async function executar(s: ResumoSolicitacao, acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(s.id)
    setMensagem(null)
    try {
      await acao()
      setMensagem({ tipo: 'success', texto: sucesso })
      lista.recarregar()
    } catch (e) {
      setMensagem({ tipo: 'error', texto: mensagemDetalhada(e) })
    } finally {
      setOcupado(null)
    }
  }

  const itens = lista.dados ?? []
  const titulo = fila ? 'Aprovações de estoque' : 'Minhas solicitações'
  return (
    <Pilha component="section" aria-labelledby="titulo-solicitacoes">
      <LinkRota to="/estoque">Voltar ao estoque</LinkRota>
      <TituloPagina id="titulo-solicitacoes">{titulo}</TituloPagina>
      <TextoSuave>
        {fila
          ? 'Baixas, alterações de preço da cantina e inativações pedidas pelos Vendedores. Nada muda no estoque ou no catálogo antes da aprovação.'
          : 'Seus pedidos de baixa, de novo preço e de inativação, com a decisão do Administrador.'}
      </TextoSuave>
      {mensagem && (
        <Aviso tipo={mensagem.tipo} titulo={mensagem.tipo === 'success' ? 'Pronto' : 'Não foi possível concluir'} onFechar={() => setMensagem(null)}>
          {mensagem.texto}
        </Aviso>
      )}
      <Tabs value={aba} onChange={(_, v: 'PENDENTE' | 'TODAS') => setAba(v)} aria-label="Situação dos pedidos">
        <Tab value="PENDENTE" label="Pendentes" />
        <Tab value="TODAS" label="Todas" />
      </Tabs>
      {lista.carregando && <Carregando />}
      {lista.erro && (
        <Aviso tipo="error" titulo="Erro">
          {lista.erro}
        </Aviso>
      )}
      {!lista.carregando && !lista.erro && itens.length === 0 && (
        <TextoSuave>{aba === 'PENDENTE' ? 'Nenhum pedido pendente.' : 'Nenhum pedido.'}</TextoSuave>
      )}
      {itens.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label={titulo}>
            <TableHead>
              <TableRow>
                <TableCell>Nº</TableCell>
                <TableCell>Pedido</TableCell>
                <TableCell>Produto</TableCell>
                <TableCell>Detalhe</TableCell>
                <TableCell>Justificativa</TableCell>
                <TableCell>Solicitante</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.id}</TableCell>
                  <TableCell>{ROTULO_TIPO_SOLICITACAO[s.tipo]}</TableCell>
                  <TableCell>
                    <LinkRota to={`/estoque/produtos/${s.produtoId}`}>{s.produtoNome}</LinkRota>
                  </TableCell>
                  <TableCell>
                    <DescricaoSolicitacao s={s} />
                  </TableCell>
                  <TableCell>
                    {s.justificativa}
                    {s.temFoto && (
                      <Box>
                        <Button size="small" onClick={() => setFoto(s)}>
                          Ver foto
                        </Button>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.solicitanteNome ?? '—'}
                    <Typography variant="body2" color="text.secondary">
                      {formatarDataHora(s.solicitadaEm)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusSolicitacaoTag status={s.status} />
                    {s.decididaPorNome && s.status !== 'PENDENTE' && (
                      <Typography variant="body2" color="text.secondary">
                        {s.status === 'CANCELADA' ? 'Cancelada' : `Por ${s.decididaPorNome}`}
                        {s.autoAprovada ? ' (autoaprovada)' : ''} em {formatarDataHora(s.decididaEm)}
                      </Typography>
                    )}
                    {s.motivoDecisao && <TextoSuave>Motivo: {s.motivoDecisao}</TextoSuave>}
                  </TableCell>
                  <TableCell align="right">
                    {s.status === 'PENDENTE' && (
                      <LinhaAcoes sx={{ justifyContent: 'flex-end' }}>
                        {fila ? (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={ocupado === s.id}
                              aria-label={`Aprovar pedido ${s.id}`}
                              onClick={() => void executar(s, () => estoqueService.aprovar(s.id), `Pedido nº ${s.id} aprovado.`)}
                            >
                              Aprovar
                            </Button>
                            <Button size="small" color="error" aria-label={`Rejeitar pedido ${s.id}`} onClick={() => setRejeitando(s)}>
                              Rejeitar
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            disabled={ocupado === s.id}
                            aria-label={`Cancelar pedido ${s.id}`}
                            onClick={() => void executar(s, () => estoqueService.cancelarSolicitacao(s.id), `Pedido nº ${s.id} cancelado.`)}
                          >
                            Cancelar pedido
                          </Button>
                        )}
                      </LinhaAcoes>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {rejeitando && (
        <ModalMotivo
          titulo="Rejeitar pedido"
          rotulo={`Pedido nº ${rejeitando.id} · ${rejeitando.produtoNome}`}
          textoConfirmar="Rejeitar"
          rotuloCampo="Motivo da rejeição"
          perigo
          onFechar={() => setRejeitando(null)}
          onConfirmar={async (motivo) => {
            await estoqueService.rejeitar(rejeitando.id, motivo)
            setRejeitando(null)
            setMensagem({ tipo: 'success', texto: `Pedido nº ${rejeitando.id} rejeitado.` })
            lista.recarregar()
          }}
        >
          <TextoSuave>Nada muda no estoque nem no preço. O Vendedor vê o motivo em “Minhas solicitações”.</TextoSuave>
        </ModalMotivo>
      )}
      {foto && <FotoDialogo solicitacao={foto} onFechar={() => setFoto(null)} />}
    </Pilha>
  )
}
