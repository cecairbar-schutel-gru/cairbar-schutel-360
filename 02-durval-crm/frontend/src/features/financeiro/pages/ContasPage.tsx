import { Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { ContasRecebimentoCartao } from '../components/ContasRecebimentoCartao'
import { ContaAtivaTag, Valor } from '../components/Tags'
import { ROTULO_TIPO_CONTA } from '../rotulos'
import { financeiroService } from '../services'
import type { ContaFinanceira } from '../types'

type Acao = { tipo: 'inativar' | 'reativar' | 'excluir'; conta: ContaFinanceira }

const TITULO_ACAO = { inativar: 'Inativar conta', reativar: 'Reativar conta', excluir: 'Excluir conta' }

function detalhes(c: ContaFinanceira): string {
  if (c.tipo === 'BANCO') return [c.banco, c.agencia && `ag. ${c.agencia}`, c.numeroConta && `c/c ${c.numeroConta}`].filter(Boolean).join(' · ')
  return c.localizacao ?? '—'
}

/**
 * Contas financeiras (US-FINANCIAL-001): o Administrador cadastra, altera, inativa (com saldo zero)
 * e exclui (sem lançamentos); o Tesoureiro cadastra e altera só contas bancárias.
 */
export function ContasPage() {
  const { perfilAtivo } = useAuth()
  const navegar = useNavigate()
  const admin = perfilAtivo === 'administrador'
  const tesouraria = admin || perfilAtivo === 'tesoureiro'
  const editavel = (c: ContaFinanceira) => admin || c.tipo === 'BANCO'
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const [acao, setAcao] = useState<Acao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function confirmar() {
    if (!acao) return
    const { tipo, conta } = acao
    setErro(null)
    try {
      if (tipo === 'inativar') await financeiroService.inativarConta(conta.id)
      if (tipo === 'reativar') await financeiroService.reativarConta(conta.id)
      if (tipo === 'excluir') await financeiroService.excluirConta(conta.id)
      setMensagem(`${conta.nome}: conta ${tipo === 'inativar' ? 'inativada' : tipo === 'reativar' ? 'reativada' : 'excluída'}.`)
      setAcao(null)
      contas.recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-contas">
      <LinkRota to="/financeiro">Voltar ao Financeiro</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-contas">Contas financeiras</TituloPagina>
        {tesouraria && (
          <Button variant="contained" onClick={() => navegar('/financeiro/contas/nova')}>
            Nova conta
          </Button>
        )}
      </LinhaAcoes>
      <TextoSuave>
        Caixas guardam o dinheiro em espécie. Saldo inicial e data de corte não mudam depois do primeiro lançamento.
      </TextoSuave>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      {contas.carregando && <Carregando />}
      {contas.erro && (
        <Aviso tipo="error" titulo="Erro">
          {contas.erro}
        </Aviso>
      )}
      {contas.dados && <ContasRecebimentoCartao contas={contas.dados} editavel={admin} />}
      {contas.dados && (
        <Table size="small" aria-label="Contas financeiras">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Detalhes</TableCell>
              <TableCell align="right">Saldo inicial</TableCell>
              <TableCell>Data de corte</TableCell>
              <TableCell align="right">Saldo atual</TableCell>
              <TableCell>Situação</TableCell>
              {tesouraria && <TableCell>Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {contas.dados.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <LinkRota to={`/financeiro/lancamentos?contaId=${c.id}`}>{c.nome}</LinkRota>
                </TableCell>
                <TableCell>{ROTULO_TIPO_CONTA[c.tipo]}</TableCell>
                <TableCell>
                  <code>{c.codigo}</code>
                </TableCell>
                <TableCell>{detalhes(c)}</TableCell>
                <TableCell align="right">
                  <Valor valor={c.saldoInicial} />
                </TableCell>
                <TableCell>{formatarData(c.dataCorte)}</TableCell>
                <TableCell align="right">
                  <Valor valor={c.saldo ?? 0} />
                </TableCell>
                <TableCell>
                  <ContaAtivaTag ativa={c.ativa} />
                </TableCell>
                {tesouraria && (
                  <TableCell>
                    <LinhaAcoes>
                      {editavel(c) && (
                        <Button size="small" onClick={() => navegar(`/financeiro/contas/${c.id}/editar`)}>
                          Editar
                        </Button>
                      )}
                      {admin && c.tipo !== 'CARTAO_A_RECEBER' && (
                        <>
                          <Button size="small" onClick={() => setAcao({ tipo: c.ativa ? 'inativar' : 'reativar', conta: c })}>
                            {c.ativa ? 'Inativar' : 'Reativar'}
                          </Button>
                          {!c.temLancamentos && (
                            <Button size="small" color="error" onClick={() => setAcao({ tipo: 'excluir', conta: c })}>
                              Excluir
                            </Button>
                          )}
                        </>
                      )}
                    </LinhaAcoes>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {acao && (
        <DialogoAcao
          aberto
          rotulo={acao.conta.nome}
          titulo={TITULO_ACAO[acao.tipo]}
          textoConfirmar={TITULO_ACAO[acao.tipo].split(' ')[0]}
          perigo={acao.tipo !== 'reativar'}
          onFechar={() => {
            setAcao(null)
            setErro(null)
          }}
          onConfirmar={() => void confirmar()}
        >
          <Pilha spacing={2}>
            {erro && (
              <Aviso tipo="error" titulo="Não foi possível concluir">
                {erro}
              </Aviso>
            )}
            <TextoSuave>
              {acao.tipo === 'inativar' &&
                'Só contas com saldo zero, que não sejam conta de recebimento, podem ser inativadas. Contas inativas não aparecem nos formulários de pagamento.'}
              {acao.tipo === 'reativar' && 'A conta volta a aparecer nos formulários de pagamento.'}
              {acao.tipo === 'excluir' && 'A conta não tem lançamentos e será removida definitivamente.'}
            </TextoSuave>
          </Pilha>
        </DialogoAcao>
      )}
    </Pilha>
  )
}
