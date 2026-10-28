import { Alert, Button, Table, TableBody, TableContainer, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { DevolucaoDialogo } from '../components/DevolucaoDialogo'
import { DialogoTexto } from '../components/DialogoTexto'
import { SituacaoRemessaTag } from '../components/Tags'
import { editoraService } from '../services'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const somar = (valores: number[]) => valores.reduce((s, v) => s + v, 0)

/**
 * Página da remessa (US-PUBLISHER-003 e 005): por título, recebidas, vendidas, devolvidas, baixadas
 * e restantes, com as obrigações criadas; devoluções com comprovante; cancelamento só enquanto
 * nenhuma unidade se moveu.
 */
export function RemessaPage() {
  const remessaId = Number(useParams().id)
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const { dados: r, carregando, erro, recarregar } = useCarregamento(() => editoraService.remessa(remessaId), [remessaId])
  const [devolvendo, setDevolvendo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(parametros.get('nova') === '1' ? 'Remessa registrada e unidades lançadas no estoque.' : null)

  if (carregando && !r) return <Carregando linhas={6} />
  if (erro || !r) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Remessa não encontrada.'}</Aviso>
  const cadastro = possuiPapel('vendedor', 'administrador')

  async function cancelar() {
    setErroMotivo(null)
    try {
      await editoraService.cancelarRemessa(remessaId, motivo)
      setCancelando(false)
      setMensagem('Remessa cancelada; as unidades saíram do estoque.')
      recarregar()
    } catch (f) {
      setErroMotivo(mensagemDeErro(f))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-remessa">
      <LinkRota to={`/editoras/${r.editoraId}`}>{r.editoraNome}</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <LinhaAcoes>
          <TituloPagina id="titulo-remessa">Remessa {r.codigo}</TituloPagina>
          <SituacaoRemessaTag situacao={r.situacao} />
          <BotaoHistorico entidade="Remessa" id={r.id} />
        </LinhaAcoes>
        {cadastro && (
          <LinhaAcoes>
            {r.podeCancelar && (
              <Button color="error" onClick={() => setCancelando(true)}>
                Cancelar remessa
              </Button>
            )}
            {r.podeDevolver && (
              <Button variant="contained" onClick={() => setDevolvendo(true)}>
                Registrar devolução
              </Button>
            )}
          </LinhaAcoes>
        )}
      </LinhaAcoes>
      {mensagem && <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>{mensagem}</Aviso>}
      <TextoSuave>
        {r.editoraNome} · recebida em {formatarData(r.recebidaEm)}
        {r.numeroDocumento && ` · documento ${r.numeroDocumento}`}
        {r.registradaPor && ` · registrada por ${r.registradaPor} em ${formatarDataHora(r.registradaEm)}`}
      </TextoSuave>
      {r.situacao === 'CANCELADA' && (
        <Alert severity="error" variant="outlined">
          Cancelada por {r.canceladaPor} em {formatarDataHora(r.canceladaEm)}: {r.motivoCancelamento}
        </Alert>
      )}

      <TableContainer>
        <Table size="small" aria-label="Títulos da remessa">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell align="right">Repasse</TableCell>
              <TableCell align="right">Recebidas</TableCell>
              <TableCell align="right">Vendidas</TableCell>
              <TableCell align="right">Devolvidas</TableCell>
              <TableCell align="right">Baixadas</TableCell>
              <TableCell align="right">Ajustes</TableCell>
              <TableCell align="right">Restantes</TableCell>
              <TableCell align="right">Obrigações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {r.itens.map((i) => (
              <TableRow key={i.produtoId}>
                <TableCell>
                  <LinkRota to={`/estoque/produtos/${i.produtoId}`}>{i.titulo}</LinkRota>
                  {i.autor && (
                    <Typography variant="body2" color="text.secondary">
                      {i.autor}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{percentual.format(i.repassePercentual)}%</TableCell>
                <TableCell align="right">{i.recebida}</TableCell>
                <TableCell align="right">{i.vendida}</TableCell>
                <TableCell align="right">{i.devolvida}</TableCell>
                <TableCell align="right">{i.baixada}</TableCell>
                <TableCell align="right">{i.ajustes}</TableCell>
                <TableCell align="right">{i.restante}</TableCell>
                <TableCell align="right">{formatarMoeda(i.obrigacoes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.recebida))}</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.vendida))}</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.devolvida))}</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.baixada))}</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.ajustes))}</TableCell>
              <TableCell align="right">{somar(r.itens.map((i) => i.restante))}</TableCell>
              <TableCell align="right">{formatarMoeda(somar(r.itens.map((i) => i.obrigacoes)))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      <Typography variant="h6" component="h2">
        Devoluções
      </Typography>
      {r.devolucoes.length === 0 ? (
        <TextoSuave>Nenhuma devolução registrada.</TextoSuave>
      ) : (
        <Table size="small" aria-label="Devoluções">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Títulos</TableCell>
              <TableCell>Observação</TableCell>
              <TableCell>Registrada por</TableCell>
              <TableCell align="right">Comprovante</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {r.devolucoes.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{formatarData(d.devolvidaEm)}</TableCell>
                <TableCell>{d.itens.map((i) => `${i.quantidade} × ${i.titulo}`).join(', ')}</TableCell>
                <TableCell>{d.observacao ?? '—'}</TableCell>
                <TableCell>{d.registradaPor}</TableCell>
                <TableCell align="right">
                  <LinkRota to={`/editoras/devolucoes/${d.id}`}>Imprimir</LinkRota>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {devolvendo && (
        <DevolucaoDialogo
          remessa={r}
          onFechar={() => setDevolvendo(false)}
          onDevolvida={(d) => {
            setDevolvendo(false)
            navegar(`/editoras/devolucoes/${d.id}?nova=1`)
          }}
        />
      )}
      <DialogoTexto
        aberto={cancelando}
        titulo={`Cancelar a remessa ${r.codigo}`}
        descricao="As unidades recebidas saem do estoque. Use para corrigir um erro de registro e registre a remessa de novo."
        rotulo="Motivo do cancelamento"
        textoConfirmar="Cancelar remessa"
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
