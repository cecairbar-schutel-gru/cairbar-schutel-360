import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import { Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { MinhasSolicitacoes } from '../../estoque/components/MinhasSolicitacoes'
import { ComprasAguardandoRecebimento, MinhasIntencoesResumo } from '../../intencoes/components/ResumosPainel'
import { vendaService } from '../services'

/** Painel do Vendedor (wireframe 2, US-SALES-021): vender rápido e ver o resumo do dia das suas vendas e das do PDV da cantina. */
export function PainelVendedorPage() {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const painel = useCarregamento(() => vendaService.painelVendedor(), [])

  return (
    <Pilha component="section" aria-labelledby="titulo-painel">
      <TituloPagina id="titulo-painel">Olá, {usuario?.nome}</TituloPagina>
      <LinhaAcoes>
        <Button
          variant="contained"
          size="large"
          startIcon={<PointOfSaleIcon />}
          onClick={() => navegar('/vendas/nova')}
          sx={{ py: 2, px: 4 }}
        >
          Nova venda
        </Button>
        <Button variant="outlined" onClick={() => navegar('/vendas')}>
          Vendas de hoje
        </Button>
        <Button variant="outlined" onClick={() => navegar('/estoque/entrada-doacao')}>
          Entrada por doação
        </Button>
        <Button variant="outlined" onClick={() => navegar('/estoque')}>
          Estoque
        </Button>
        <Button variant="outlined" onClick={() => navegar('/estoque/produtos/novo?tipo=CANTINA')}>
          Novo produto da cantina
        </Button>
        <Button variant="outlined" onClick={() => navegar('/contribuicoes/anonima')}>
          Receber doação
        </Button>
        <Button variant="outlined" onClick={() => navegar('/intencoes-gasto/nova')}>
          Nova intenção de gasto
        </Button>
      </LinhaAcoes>

      {painel.carregando && <Carregando />}
      {painel.erro && <Aviso tipo="error" titulo="Erro">{painel.erro}</Aviso>}
      {painel.dados && (
        <>
          <Typography variant="h5" component="h2">
            Hoje, {formatarData(painel.dados.data)}
          </Typography>
          <GradeForm>
            <Indicador rotulo="Vendas" valor={String(painel.dados.quantidade)} />
            <Indicador rotulo="Dinheiro" valor={formatarMoeda(painel.dados.totalDinheiro)} />
            <Indicador rotulo="PIX" valor={formatarMoeda(painel.dados.totalPix)} />
            <Indicador rotulo="Cartão" valor={formatarMoeda(painel.dados.totalCartao)} />
            <Indicador rotulo="Cancelamentos" valor={String(painel.dados.cancelamentos)} />
          </GradeForm>
          <TextoSuave>Inclui as vendas do PDV da cantina.</TextoSuave>
          <LinkRota to="/vendas">Ver as vendas de hoje</LinkRota>
        </>
      )}

      <Typography variant="h5" component="h2">
        Compras aguardando seu recebimento
      </Typography>
      <ComprasAguardandoRecebimento />

      <Typography variant="h5" component="h2">
        Minhas intenções de gasto
      </Typography>
      <MinhasIntencoesResumo />

      <Typography variant="h5" component="h2">
        Minhas solicitações
      </Typography>
      <MinhasSolicitacoes />
    </Pilha>
  )
}
