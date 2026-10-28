import PrintIcon from '@mui/icons-material/Print'
import {
  Alert,
  Box,
  Button,
  GlobalStyles,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro, salvarArquivo } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CancelarVendaModal } from '../components/CancelarVendaModal'
import { ComprovanteVenda } from '../components/ComprovanteVenda'
import { StatusVendaTag } from '../components/StatusVendaTag'
import { vendaService } from '../services'
import type { LayoutComprovante } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

/**
 * Comprovante logo após a confirmação (`?nova=1`, US-SALES-008) e detalhe da venda (US-SALES-011):
 * reemissão, cancelamento, refazer, remessas usadas e obrigações criadas.
 */
export function VendaPage() {
  const { id } = useParams()
  const vendaId = Number(id)
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const nova = params.get('nova') === '1'
  const { dados: venda, carregando, erro, recarregar } = useCarregamento(() => vendaService.detalhe(vendaId), [vendaId])
  const [cancelando, setCancelando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  if (carregando && !venda) return <Carregando linhas={6} />
  if (erro || !venda) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Venda não encontrada.'}</Aviso>

  async function baixar(layout: LayoutComprovante) {
    setFalha(null)
    try {
      salvarArquivo(await vendaService.baixarComprovantePdf(vendaId, layout))
    } catch (e) {
      setFalha(mensagemDeErro(e))
    }
  }

  const vendedor = possuiPapel('vendedor')
  // O Tesoureiro cancela as vendas do PDV da cantina (US-SALES-022); o Vendedor só vê as próprias.
  const podeCancelar =
    venda.status === 'CONCLUIDA' && (possuiPapel('vendedor', 'administrador') || (venda.pdv && possuiPapel('tesoureiro')))
  const podeRefazer = vendedor && venda.status === 'CANCELADA' && venda.refeitaComo === null
  const consignados = venda.itens.flatMap((i) =>
    i.lotes.filter((l) => l.remessaId !== null).map((l) => ({ ...l, produtoNome: i.produtoNome, preco: i.precoUnitario })),
  )

  return (
    <Pilha component="section" aria-labelledby="titulo-venda">
      {/* Impressão: só o comprovante, sem o shell nem as ações (80 mm ou A4 pela impressora). */}
      <GlobalStyles
        styles={{
          '@media print': {
            'header, nav, .MuiDrawer-root, [data-nao-imprimir]': { display: 'none !important' },
            main: { padding: '0 !important' },
          },
        }}
      />
      <LinhaAcoes data-nao-imprimir>
        <TituloPagina id="titulo-venda">Venda nº {venda.numero}</TituloPagina>
        <StatusVendaTag status={venda.status} />
        <BotaoHistorico entidade="VENDA" id={venda.id} />
      </LinhaAcoes>
      {nova && (
        <Alert severity="success" variant="outlined" data-nao-imprimir>
          Venda nº {venda.numero} registrada: {formatarMoeda(venda.total)}.
        </Alert>
      )}
      {venda.refazVenda && (
        <TextoSuave>
          Refaz a venda cancelada{' '}
          <LinkRota to={`/vendas/${venda.refazVenda.id}`}>nº {venda.refazVenda.numero}</LinkRota>.
        </TextoSuave>
      )}
      {venda.refeitaComo && (
        <Typography>
          Refeita como <LinkRota to={`/vendas/${venda.refeitaComo.id}`}>nº {venda.refeitaComo.numero}</LinkRota>.
        </Typography>
      )}
      {falha && <Aviso tipo="error" titulo="Erro" onFechar={() => setFalha(null)}>{falha}</Aviso>}

      <LinhaAcoes data-nao-imprimir>
        {nova && vendedor && (
          <Button variant="contained" onClick={() => navegar('/vendas/nova')}>
            Nova venda
          </Button>
        )}
        <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => window.print()}>
          Imprimir
        </Button>
        <Button variant="outlined" onClick={() => void baixar('A4')}>
          Baixar PDF (A4)
        </Button>
        <Button variant="outlined" onClick={() => void baixar('TERMICA')}>
          Baixar PDF (80 mm)
        </Button>
        {podeCancelar && (
          <Button color="error" variant="outlined" onClick={() => setCancelando(true)}>
            Cancelar venda
          </Button>
        )}
        {podeRefazer && (
          <Button variant="outlined" onClick={() => navegar(`/vendas/nova?refazer=${venda.id}`)}>
            Refazer venda
          </Button>
        )}
      </LinhaAcoes>

      <ComprovanteVenda venda={venda} />

      <Box data-nao-imprimir>
        <Pilha spacing={2}>
          {venda.status === 'CANCELADA' && (
            <Aviso tipo="error" titulo="Venda cancelada">
              Por {venda.canceladaPor ?? '—'} em {formatarDataHora(venda.canceladaEm)}. Motivo:{' '}
              {venda.motivoCancelamento}
            </Aviso>
          )}
          <Typography variant="h5" component="h2">
            Remessas e obrigações com editoras
          </Typography>
          {consignados.length === 0 ? (
            <TextoSuave>Nenhum livro consignado nesta venda.</TextoSuave>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Remessas usadas e obrigações criadas">
                <TableHead>
                  <TableRow>
                    <TableCell>Título</TableCell>
                    <TableCell>Remessa</TableCell>
                    <TableCell align="right">Qtd</TableCell>
                    <TableCell align="right">Repasse</TableCell>
                    <TableCell align="right">Obrigação</TableCell>
                    <TableCell>Situação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {consignados.map((l) => (
                    <TableRow key={`${l.produtoNome}-${l.remessaId}`}>
                      <TableCell>{l.produtoNome}</TableCell>
                      <TableCell>{l.remessaCodigo}</TableCell>
                      <TableCell align="right">{l.quantidade}</TableCell>
                      <TableCell align="right">{l.repassePercentual}%</TableCell>
                      <TableCell align="right">{formatarMoeda(l.valorObrigacao ?? 0)}</TableCell>
                      <TableCell>{venda.status === 'CANCELADA' ? 'Estornada' : 'Em aberto'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <LinhaAcoes>
            {!nova && vendedor && (
              <Button variant="contained" onClick={() => navegar('/vendas/nova')}>
                Nova venda
              </Button>
            )}
            <LinkRota to="/vendas">Voltar às vendas</LinkRota>
          </LinhaAcoes>
        </Pilha>
      </Box>

      {cancelando && (
        <CancelarVendaModal
          venda={venda}
          onFechar={() => setCancelando(false)}
          onCancelada={() => {
            setCancelando(false)
            recarregar()
          }}
        />
      )}
    </Pilha>
  )
}
