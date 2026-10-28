import { Box, Card, CardContent, Divider, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { formatarData } from '../../../shared/formatters/datas'
import { Valor } from '../../financeiro/components/Tags'
import { diferencaZerada } from '../regras'
import type { SessaoConciliacao } from '../types'

function Linha({
  rotulo,
  children,
  destaque,
}: {
  rotulo: string
  children: ReactNode
  destaque?: boolean
}) {
  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}
    >
      <Typography
        variant={destaque ? 'subtitle1' : 'body2'}
        component="dt"
        sx={{ fontWeight: destaque ? 600 : undefined }}
      >
        {rotulo}
      </Typography>
      <Typography
        variant={destaque ? 'subtitle1' : 'body2'}
        component="dd"
        sx={{ m: 0, fontWeight: destaque ? 600 : undefined }}
      >
        {children}
      </Typography>
    </Box>
  )
}

/**
 * Painel sempre visível da sessão (US-RECONCILIATION-003, padrão do "Resumo" do wireframe 7):
 * saldo conciliado anterior, total marcado, saldo do extrato e a diferença.
 */
export function ResumoSessao({
  sessao: s,
  acoes,
}: {
  sessao: SessaoConciliacao
  acoes?: ReactNode
}) {
  const zerada = diferencaZerada(s.diferenca)
  return (
    <Card
      variant="outlined"
      component="aside"
      aria-labelledby="titulo-resumo-conciliacao"
    >
      <CardContent>
        <Typography
          id="titulo-resumo-conciliacao"
          variant="h6"
          component="h2"
          gutterBottom
        >
          Resumo
        </Typography>
        <Box component="dl" sx={{ m: 0 }}>
          <Linha
            rotulo={
              s.dataFimAnterior
                ? `Saldo conciliado em ${formatarData(s.dataFimAnterior)}`
                : 'Saldo conciliado anterior'
            }
          >
            <Valor valor={s.saldoAbertura} />
          </Linha>
          <Linha rotulo="Total marcado">
            <Valor valor={s.totalMarcado} />
          </Linha>
          <Linha rotulo="Saldo pelo sistema">
            <Valor valor={s.saldoConciliado} />
          </Linha>
          <Linha rotulo={`Saldo do extrato em ${formatarData(s.dataFim)}`}>
            <Valor valor={s.saldoExtrato} />
          </Linha>
          <Divider sx={{ my: 1 }} />
          <Box aria-live="polite">
            <Linha rotulo="Diferença" destaque>
              <Typography
                component="span"
                variant="inherit"
                color={zerada ? 'success.dark' : 'error'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                <Valor valor={s.diferenca} negrito />
              </Typography>
            </Linha>
            <Typography variant="caption" component="p" color="text.secondary">
              {zerada
                ? 'O sistema bate com o extrato.'
                : 'Extrato − (saldo anterior + marcados). Marque o que está no extrato, adicione o que falta ou corrija por estorno.'}
            </Typography>
          </Box>
        </Box>
        {acoes && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {acoes}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
