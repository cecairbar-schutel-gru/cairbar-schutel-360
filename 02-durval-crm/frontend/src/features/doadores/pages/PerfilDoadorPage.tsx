import { Box, Button, Tab, Tabs } from '@mui/material'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { HistoricoContribuicoesTab } from '../../contribuicoes/components/HistoricoContribuicoesTab'
import { CompetenciasTab } from '../components/CompetenciasTab'
import {
  AnonimizarDoadorModal,
  InativarDoadorModal,
  ReativarDoadorModal,
} from '../components/CicloDeVidaModais'
import { DadosDoadorForm } from '../components/DadosDoadorForm'
import { NotasTab } from '../components/NotasTab'
import { StatusTag } from '../components/StatusTag'
import { doadorService } from '../services'
import type { Doador } from '../types'
import { BotaoHistorico } from '../../administracao/components/HistoricoAuditoria'

type Modal = 'inativar' | 'reativar' | 'anonimizar' | null

const ABAS = ['Dados', 'Competências', 'Contribuições', 'Notas'] as const

/** Painel de aba; todos ficam montados para preservar o estado (ex.: formulário em edição). */
function PainelAba({
  indice,
  ativa,
  children,
}: {
  indice: number
  ativa: number
  children: ReactNode
}) {
  return (
    <Box
      role="tabpanel"
      id={`perfil-painel-${indice}`}
      aria-labelledby={`perfil-aba-${indice}`}
      hidden={indice !== ativa}
      sx={{ pt: 3 }}
    >
      {children}
    </Box>
  )
}

export function PerfilDoadorPage() {
  const { id } = useParams()
  const doadorId = Number(id)
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const { dados, carregando, erro, recarregar } = useCarregamento(
    () => doadorService.obter(doadorId),
    [doadorId],
  )
  const [modal, setModal] = useState<Modal>(null)
  const [versao, setVersao] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aba, setAba] = useState(0)

  if (carregando && !dados) return <Carregando linhas={4} />
  if (erro || !dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {erro ?? 'Doador não encontrado.'}
      </Aviso>
    )
  }

  const doador: Doador = dados
  const admin = possuiPapel('administrador')
  const operador = possuiPapel('operador')
  const anonimizado = doador.status === 'ANONIMIZADO'
  const destacarReceber =
    params.get('acao') === 'receber' && operador && doador.status === 'ATIVO'

  function concluido(mensagem: string) {
    return () => {
      setModal(null)
      setAviso(mensagem)
      setVersao((v) => v + 1)
      recarregar()
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-doador">
      <div>
        <LinkRota to="/doadores">Voltar à busca</LinkRota>
      </div>
      <LinhaAcoes>
        <TituloPagina id="titulo-doador">{doador.nome}</TituloPagina>
        <StatusTag status={doador.status} />
        <BotaoHistorico entidade="DOADOR" id={doador.id} />
      </LinhaAcoes>
      {doador.status === 'INATIVO' && (
        <TextoSuave>
          Inativado em {formatarDataHora(doador.inativadoEm)}. Motivo:{' '}
          {doador.motivoInativacao ?? '—'}
        </TextoSuave>
      )}
      {anonimizado && (
        <Aviso tipo="info" titulo="Doador anonimizado">
          Os dados pessoais foram apagados e o registro não pode ser alterado
          nem reativado.
        </Aviso>
      )}
      {aviso && (
        <Aviso
          tipo="success"
          titulo="Concluído"
          onFechar={() => setAviso(null)}
        >
          {aviso}
        </Aviso>
      )}

      <LinhaAcoes>
        {operador && doador.status === 'ATIVO' && (
          <Button
            variant="contained"
            autoFocus={destacarReceber}
            sx={
              destacarReceber
                ? (theme) => ({
                    outline: `2px solid ${theme.palette.primary.dark}`,
                    outlineOffset: 2,
                  })
                : undefined
            }
            onClick={() => navegar(`/contribuicoes/nova/${doador.id}`)}
          >
            Receber contribuição
          </Button>
        )}
        {operador && doador.status === 'ATIVO' && (
          <Button
            variant="outlined"
            onClick={() => navegar(`/contribuicoes/nova/${doador.id}?doacao=1`)}
          >
            Registrar doação
          </Button>
        )}
        {admin && doador.status === 'ATIVO' && (
          <Button variant="outlined" onClick={() => setModal('inativar')}>
            Inativar
          </Button>
        )}
        {admin && doador.status === 'INATIVO' && (
          <Button variant="outlined" onClick={() => setModal('reativar')}>
            Reativar
          </Button>
        )}
        {admin && !anonimizado && (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setModal('anonimizar')}
          >
            Anonimizar
          </Button>
        )}
      </LinhaAcoes>

      <div>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={aba}
            onChange={(_, valor: number) => setAba(valor)}
            aria-label="Seções do perfil"
          >
            {ABAS.map((rotulo, i) => (
              <Tab
                key={rotulo}
                label={rotulo}
                id={`perfil-aba-${i}`}
                aria-controls={`perfil-painel-${i}`}
              />
            ))}
          </Tabs>
        </Box>
        <PainelAba indice={0} ativa={aba}>
          <DadosDoadorForm
            key={`${doador.id}-${versao}`}
            doador={doador}
            somenteLeitura={anonimizado}
            onSalvo={() => recarregar()}
          />
        </PainelAba>
        <PainelAba indice={1} ativa={aba}>
          <CompetenciasTab doadorId={doador.id} versao={versao} />
        </PainelAba>
        <PainelAba indice={2} ativa={aba}>
          <HistoricoContribuicoesTab doadorId={doador.id} versao={versao} />
        </PainelAba>
        <PainelAba indice={3} ativa={aba}>
          <NotasTab doadorId={doador.id} somenteLeitura={anonimizado} />
        </PainelAba>
      </div>

      {modal === 'inativar' && (
        <InativarDoadorModal
          doador={doador}
          aberto
          onFechar={() => setModal(null)}
          onConcluido={concluido('Doador inativado.')}
        />
      )}
      {modal === 'reativar' && (
        <ReativarDoadorModal
          doador={doador}
          aberto
          onFechar={() => setModal(null)}
          onConcluido={concluido('Doador reativado.')}
        />
      )}
      {modal === 'anonimizar' && (
        <AnonimizarDoadorModal
          doador={doador}
          aberto
          onFechar={() => setModal(null)}
          onConcluido={concluido('Doador anonimizado.')}
        />
      )}
    </Pilha>
  )
}
