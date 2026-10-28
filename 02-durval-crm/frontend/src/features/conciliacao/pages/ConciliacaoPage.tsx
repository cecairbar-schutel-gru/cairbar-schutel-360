import {
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { formatarData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { Valor } from '../../financeiro/components/Tags'
import { mensagemDeErro } from '../../../shared/api/http'
import { ConciliarDialogo } from '../components/ConciliarDialogo'
import { ExtratoDialogo } from '../components/ExtratoDialogo'
import { ImportarExtratoDialogo } from '../components/ImportarExtratoDialogo'
import { conciliacaoService } from '../services'
import type {
  ContaParaConciliar,
  FormatoExtrato,
  SessaoConciliacao,
} from '../types'

function Situacao({ conta: c }: { conta: ContaParaConciliar }) {
  if (c.sessaoId !== null)
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={`Em andamento (extrato até ${formatarData(c.sessaoDataFim)})`}
      />
    )
  if (c.conciliadaAte === null)
    return <Chip size="small" variant="outlined" label="Nunca conciliada" />
  return (
    <Chip size="small" color="success" variant="outlined" label="Conciliada" />
  )
}

/**
 * Conciliação bancária (US-RECONCILIATION-001): toda conta bancária ativa com a data até a qual está
 * conciliada, os lançamentos ainda não conciliados e a sessão em andamento, que é retomada.
 */
export function ConciliacaoPage() {
  const { perfilAtivo } = useAuth()
  const navegar = useNavigate()
  const contas = useCarregamento(() => conciliacaoService.contas(), [])
  const [iniciando, setIniciando] = useState<ContaParaConciliar | null>(null)
  // Botão "Conciliar" da página: conta e formato → (início da sessão) → importação do extrato.
  const [conciliando, setConciliando] = useState(false)
  const [formato, setFormato] = useState<FormatoExtrato | null>(null)
  const [importando, setImportando] = useState<{
    sessao: SessaoConciliacao
    nova: boolean
  } | null>(null)
  const [erroSessao, setErroSessao] = useState<string | null>(null)
  // Tesoureiro e Administrador conciliam.
  const tesouraria =
    perfilAtivo === 'tesoureiro' || perfilAtivo === 'administrador'

  return (
    <Pilha component="section" aria-labelledby="titulo-conciliacao">
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-conciliacao">
          Conciliação bancária
        </TituloPagina>
        <LinhaAcoes>
          {tesouraria && (
            <Button
              variant="contained"
              disabled={!contas.dados}
              onClick={() => {
                setErroSessao(null)
                setConciliando(true)
              }}
            >
              Conciliar
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => navegar('/conciliacao/historico')}
          >
            Histórico de conciliações
          </Button>
        </LinhaAcoes>
      </LinhaAcoes>
      <TextoSuave>
        Compare os lançamentos de cada conta bancária com o extrato do banco e
        marque o que bate. Antes do fechamento mensal, toda conta deve estar
        conciliada até o último dia do mês.
      </TextoSuave>
      {contas.carregando && <Carregando />}
      {erroSessao && (
        <Aviso tipo="error" titulo="Não foi possível abrir a conciliação">
          {erroSessao}
        </Aviso>
      )}
      {contas.erro && (
        <Aviso tipo="error" titulo="Erro">
          {contas.erro}
        </Aviso>
      )}
      {contas.dados && contas.dados.length === 0 && (
        <TextoSuave>Nenhuma conta bancária ativa.</TextoSuave>
      )}
      {contas.dados && contas.dados.length > 0 && (
        <TableContainer>
          <Table aria-label="Contas bancárias">
            <TableHead>
              <TableRow>
                <TableCell>Conta</TableCell>
                <TableCell>Conciliada até</TableCell>
                <TableCell align="right">Saldo conciliado</TableCell>
                <TableCell align="right">Não conciliados</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contas.dados.map((c) => (
                <TableRow key={c.contaId} hover>
                  <TableCell>
                    {c.contaNome}
                    <Typography
                      variant="caption"
                      component="span"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {[
                        c.banco,
                        c.agencia && `Ag. ${c.agencia}`,
                        c.numeroConta && `Conta ${c.numeroConta}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.conciliadaAte ? formatarData(c.conciliadaAte) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {c.saldoConciliado === null ? (
                      '—'
                    ) : (
                      <Valor valor={c.saldoConciliado} />
                    )}
                  </TableCell>
                  <TableCell align="right">{c.naoConciliados}</TableCell>
                  <TableCell>
                    <Situacao conta={c} />
                  </TableCell>
                  <TableCell>
                    <LinhaAcoes>
                      {c.sessaoId !== null ? (
                        <Button
                          size="small"
                          variant={tesouraria ? 'contained' : 'text'}
                          onClick={() => navegar(`/conciliacao/${c.sessaoId}`)}
                          aria-label={`${tesouraria ? 'Continuar' : 'Ver'} a conciliação de ${c.contaNome}`}
                        >
                          {tesouraria ? 'Continuar' : 'Ver sessão'}
                        </Button>
                      ) : (
                        tesouraria && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => setIniciando(c)}
                            aria-label={`Conciliar ${c.contaNome}`}
                          >
                            Conciliar
                          </Button>
                        )
                      )}
                      <LinkRota
                        to={`/conciliacao/historico?contaId=${c.contaId}`}
                      >
                        Histórico
                      </LinkRota>
                    </LinhaAcoes>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {iniciando && (
        <ExtratoDialogo
          titulo="Iniciar conciliação"
          contaNome={iniciando.contaNome}
          conciliadaAte={iniciando.conciliadaAte}
          saldoAbertura={iniciando.saldoConciliado}
          textoConfirmar="Iniciar"
          onFechar={() => {
            setIniciando(null)
            setFormato(null)
          }}
          onConfirmar={async (dataFim, saldo) => {
            const sessao = await conciliacaoService.iniciar(
              iniciando.contaId,
              dataFim,
              saldo,
            )
            setIniciando(null)
            // Vindo do botão "Conciliar", segue para a importação do extrato escolhido.
            if (formato) setImportando({ sessao, nova: true })
            else navegar(`/conciliacao/${sessao.id}`)
          }}
        />
      )}
      {conciliando && contas.dados && (
        <ConciliarDialogo
          contas={contas.dados}
          onFechar={() => setConciliando(false)}
          onContinuar={async (conta, formatoEscolhido) => {
            setConciliando(false)
            setFormato(formatoEscolhido)
            if (conta.sessaoId === null) return setIniciando(conta)
            try {
              setImportando({
                sessao: await conciliacaoService.sessao(conta.sessaoId),
                nova: false,
              })
            } catch (e) {
              setErroSessao(mensagemDeErro(e))
            }
          }}
        />
      )}
      {importando && formato && (
        <ImportarExtratoDialogo
          sessao={importando.sessao}
          formato={formato}
          onFechar={() => {
            // A sessão recém-iniciada já existe: abre-a mesmo sem o extrato.
            if (importando.nova) navegar(`/conciliacao/${importando.sessao.id}`)
            setImportando(null)
            setFormato(null)
          }}
          onImportado={(sessao) => navegar(`/conciliacao/${sessao.id}`)}
        />
      )}
    </Pilha>
  )
}
