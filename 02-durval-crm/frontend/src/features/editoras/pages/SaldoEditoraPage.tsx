import { Button, FormControlLabel, Switch, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { TabelaObrigacoes } from '../components/TabelaObrigacoes'
import { TabelaPagamentos } from '../components/TabelaPagamentos'
import { editoraService } from '../services'

/**
 * Detalhe do saldo devido a uma editora (US-PUBLISHER-006): obrigações em aberto e estornadas (o
 * que já tinha sido pago de uma venda cancelada vira crédito) e pagamentos.
 */
export function SaldoEditoraPage() {
  const editoraId = Number(useParams().id)
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const [todas, setTodas] = useState(false)
  const { dados: s, carregando, erro } = useCarregamento(() => editoraService.saldo(editoraId), [editoraId])
  if (carregando && !s) return <Carregando linhas={6} />
  if (erro || !s) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Editora não encontrada.'}</Aviso>
  const visiveis = todas ? s.obrigacoes : s.obrigacoes.filter((o) => o.status !== 'PAGA')
  return (
    <Pilha component="section" aria-labelledby="titulo-saldo-editora">
      <LinkRota to="/editoras/saldos">Voltar aos saldos</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-saldo-editora">Saldo devido — {s.editora.nome}</TituloPagina>
        <LinhaAcoes>
          <Button variant="outlined" onClick={() => navegar(`/editoras/${editoraId}/apuracao`)}>
            Apuração mensal
          </Button>
          {possuiPapel('tesoureiro') && s.saldoDevido > 0 && (
            <Button variant="contained" onClick={() => navegar(`/editoras/pagamento?editoraId=${editoraId}`)}>
              Pagar
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>
      <GradeForm>
        <Indicador rotulo="Obrigações" valor={formatarMoeda(s.totalObrigacoes)} />
        <Indicador rotulo="Estornos" valor={formatarMoeda(s.totalEstornos)} detalhe="Vendas canceladas" />
        <Indicador rotulo="Pagamentos" valor={formatarMoeda(s.totalPagamentos)} />
        <Indicador
          rotulo={s.saldoDevido < 0 ? 'Crédito da editora' : 'Saldo devido'}
          valor={formatarMoeda(Math.abs(s.saldoDevido))}
          destaque={s.saldoDevido > 0 ? 'warning' : 'success'}
          detalhe={s.creditoDisponivel > 0 ? `Crédito a aplicar: ${formatarMoeda(s.creditoDisponivel)}` : undefined}
        />
      </GradeForm>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h2">
          Obrigações
        </Typography>
        <FormControlLabel control={<Switch checked={todas} onChange={(e) => setTodas(e.target.checked)} />} label="Mostrar também as pagas" />
      </LinhaAcoes>
      {visiveis.length === 0 ? <TextoSuave>Nenhuma obrigação em aberto.</TextoSuave> : <TabelaObrigacoes obrigacoes={visiveis} rotulo="Obrigações" />}
      <Typography variant="h6" component="h2">
        Pagamentos
      </Typography>
      {s.pagamentos.length === 0 ? <TextoSuave>Nenhum pagamento registrado.</TextoSuave> : <TabelaPagamentos pagamentos={s.pagamentos} rotulo="Pagamentos" />}
    </Pilha>
  )
}
