import PrintIcon from '@mui/icons-material/Print'
import { Alert, Box, Button, GlobalStyles } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro, salvarArquivo } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { AgradecimentoPanel } from '../components/AgradecimentoPanel'
import { CancelarContribuicaoModal } from '../components/CancelarContribuicaoModal'
import { PassosContribuicao } from '../components/PassosContribuicao'
import { ReciboView } from '../components/ReciboView'
import { listarCompetencias } from '../regras'
import { contribuicaoService } from '../services'
import type { LayoutRecibo } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

/**
 * Passo 4 (wireframe 8) logo após a confirmação (`?nova=1`) e reemissão do recibo ("2ª via")
 * a partir do histórico.
 */
export function ReciboPage() {
  const { id } = useParams()
  const contribuicaoId = Number(id)
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const nova = params.get('nova') === '1'
  const segundaVia = !nova
  const { dados: recibo, carregando, erro, recarregar } = useCarregamento(
    () => contribuicaoService.obterRecibo(contribuicaoId, segundaVia),
    [contribuicaoId, segundaVia],
  )
  const [cancelando, setCancelando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  if (carregando && !recibo) return <Carregando linhas={6} />
  if (erro || !recibo) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Recibo não encontrado.'}</Aviso>

  async function baixar(layout: LayoutRecibo) {
    setFalha(null)
    try {
      salvarArquivo(await contribuicaoService.baixarReciboPdf(contribuicaoId, layout, segundaVia))
    } catch (e) {
      setFalha(mensagemDeErro(e))
    }
  }

  const operador = possuiPapel('operador')
  const podeCancelar = possuiPapel('tesoureiro', 'administrador') && recibo.status === 'REGISTRADA'
  const anonima = recibo.tipo === 'DOACAO_ANONIMA'

  return (
    <Pilha component="section" aria-labelledby="titulo-recibo">
      {/* Impressão: só o recibo, sem o shell nem as ações. */}
      <GlobalStyles
        styles={{
          '@media print': {
            'header, nav, .MuiDrawer-root, [data-nao-imprimir]': { display: 'none !important' },
            main: { padding: '0 !important' },
          },
        }}
      />
      <LinhaAcoes>
        <TituloPagina id="titulo-recibo">Comprovante</TituloPagina>
        <Box data-nao-imprimir>
          <BotaoHistorico entidade="CONTRIBUICAO" id={contribuicaoId} />
        </Box>
      </LinhaAcoes>
      <Box data-nao-imprimir>{nova && <PassosContribuicao ativo={3} />}</Box>
      {nova && (
        <Alert severity="success" variant="outlined">
          Contribuição registrada. Recibo nº {recibo.numero}
          {recibo.competencias.length > 0 &&
            ` — competências quitadas: ${listarCompetencias(recibo.competencias.map((c) => c.mes))}`}
          .
        </Alert>
      )}
      {falha && <Aviso tipo="error" titulo="Erro" onFechar={() => setFalha(null)}>{falha}</Aviso>}
      <LinhaAcoes data-nao-imprimir>
        <Button variant="outlined" onClick={() => void baixar('A4')}>
          Baixar PDF (A4)
        </Button>
        <Button variant="outlined" onClick={() => void baixar('TERMICA')}>
          Baixar PDF (80 mm)
        </Button>
        <Button startIcon={<PrintIcon />} onClick={() => window.print()}>
          Imprimir
        </Button>
        {podeCancelar && (
          <Button color="error" variant="outlined" onClick={() => setCancelando(true)}>
            Cancelar contribuição
          </Button>
        )}
      </LinhaAcoes>
      <ReciboView recibo={recibo} />
      {/* US-CONTRIB-008: a doação anônima pula a mensagem de agradecimento. */}
      {nova && operador && !anonima && recibo.status === 'REGISTRADA' && (
        <Box data-nao-imprimir>
          <AgradecimentoPanel recibo={recibo} />
        </Box>
      )}
      <LinhaAcoes data-nao-imprimir>
        {operador && (
          <Button variant="contained" onClick={() => navegar(anonima ? '/contribuicoes/anonima' : '/contribuicoes/nova')}>
            {anonima ? 'Nova doação anônima' : 'Nova contribuição'}
          </Button>
        )}
        <Button onClick={() => navegar('/')}>Voltar ao painel</Button>
        {recibo.doadorId !== null && possuiPapel('operador', 'administrador') && (
          <LinkRota to={`/doadores/${recibo.doadorId}`}>Perfil do doador</LinkRota>
        )}
      </LinhaAcoes>
      {cancelando && (
        <CancelarContribuicaoModal
          recibo={recibo}
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
