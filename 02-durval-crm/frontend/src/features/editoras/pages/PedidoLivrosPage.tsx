import { Alert, Button, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { DialogoTexto } from '../components/DialogoTexto'
import { SituacaoPedidoTag } from '../components/Tags'
import { editoraService } from '../services'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

const somar = (valores: number[]) => valores.reduce((s, v) => s + v, 0)

/**
 * Pedido de livros: títulos e quantidades pedidas e, depois de recebido, a conferência com a remessa.
 * A Tesouraria cancela enquanto aguarda entrega; o Vendedor registra a remessa contra o pedido.
 */
export function PedidoLivrosPage() {
  const pedidoId = Number(useParams().id)
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const { dados: p, carregando, erro, recarregar } = useCarregamento(() => editoraService.pedido(pedidoId), [pedidoId])
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(parametros.get('novo') === '1' ? 'Pedido registrado.' : null)

  if (carregando && !p) return <Carregando linhas={6} />
  if (erro || !p) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Pedido não encontrado.'}</Aviso>
  const tesouraria = possuiPapel('tesoureiro', 'administrador')
  const recebe = possuiPapel('vendedor', 'administrador')
  const recebido = p.status === 'RECEBIDO'
  const divergente = recebido && p.itens.some((i) => i.recebida !== i.pedida)

  async function cancelar() {
    setErroMotivo(null)
    try {
      await editoraService.cancelarPedido(pedidoId, motivo)
      setCancelando(false)
      setMensagem('Pedido cancelado.')
      recarregar()
    } catch (f) {
      setErroMotivo(mensagemDeErro(f))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-pedido">
      <LinkRota to={tesouraria ? '/editoras/pedidos' : `/editoras/${p.editoraId}`}>
        {tesouraria ? 'Voltar aos pedidos' : p.editoraNome}
      </LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <LinhaAcoes>
          <TituloPagina id="titulo-pedido">Pedido de livros nº {p.id}</TituloPagina>
          <SituacaoPedidoTag situacao={p.status} />
          <BotaoHistorico entidade="PedidoLivros" id={p.id} />
        </LinhaAcoes>
        {p.status === 'ABERTO' && (
          <LinhaAcoes>
            {tesouraria && (
              <Button color="error" onClick={() => setCancelando(true)}>
                Cancelar pedido
              </Button>
            )}
            {recebe && (
              <Button variant="contained" onClick={() => navegar(`/editoras/remessas/nova?editoraId=${p.editoraId}&pedidoId=${p.id}`)}>
                Registrar remessa recebida
              </Button>
            )}
          </LinhaAcoes>
        )}
      </LinhaAcoes>
      {mensagem && <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>{mensagem}</Aviso>}
      <TextoSuave>
        <LinkRota to={`/editoras/${p.editoraId}`}>{p.editoraNome}</LinkRota> · pedido por {p.pedidoPor} em {formatarDataHora(p.pedidoEm)}
        {p.remessaId && (
          <>
            {' · recebido na remessa '}
            <LinkRota to={`/editoras/remessas/${p.remessaId}`}>{p.remessaCodigo}</LinkRota>
          </>
        )}
      </TextoSuave>
      {p.observacao && <Typography>{p.observacao}</Typography>}
      {p.status === 'CANCELADO' && (
        <Alert severity="error" variant="outlined">
          Cancelado por {p.canceladoPor} em {formatarDataHora(p.canceladoEm)}: {p.motivoCancelamento}
        </Alert>
      )}
      {divergente && (
        <Alert severity="warning" variant="outlined">
          A remessa recebida não bate com o pedido em algum título. Confira as diferenças abaixo com a editora.
        </Alert>
      )}

      <TableContainer>
        <Table size="small" aria-label="Títulos do pedido">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell align="right">Pedidas</TableCell>
              {recebido && <TableCell align="right">Recebidas</TableCell>}
              {recebido && <TableCell align="right">Diferença</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {p.itens.map((i) => (
              <TableRow key={i.produtoId}>
                <TableCell>
                  <LinkRota to={`/estoque/produtos/${i.produtoId}`}>{i.titulo}</LinkRota>
                  {i.autor && (
                    <Typography variant="body2" color="text.secondary">
                      {i.autor}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{i.pedida}</TableCell>
                {recebido && <TableCell align="right">{i.recebida}</TableCell>}
                {recebido && (
                  <TableCell align="right" sx={{ color: i.recebida !== i.pedida ? 'warning.main' : undefined }}>
                    {(i.recebida ?? 0) - i.pedida}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell align="right">{somar(p.itens.map((i) => i.pedida))}</TableCell>
              {recebido && <TableCell align="right">{somar(p.itens.map((i) => i.recebida ?? 0))}</TableCell>}
              {recebido && <TableCell align="right">{somar(p.itens.map((i) => (i.recebida ?? 0) - i.pedida))}</TableCell>}
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      <DialogoTexto
        aberto={cancelando}
        titulo={`Cancelar o pedido nº ${p.id}`}
        descricao="O pedido deixa de aguardar entrega e não poderá mais receber remessa."
        rotulo="Motivo do cancelamento"
        textoConfirmar="Cancelar pedido"
        perigo
        valor={motivo}
        erro={erroMotivo}
        onAlterar={setMotivo}
        onFechar={() => setCancelando(false)}
        onConfirmar={() => void cancelar()}
      />
    </Pilha>
  )
}
