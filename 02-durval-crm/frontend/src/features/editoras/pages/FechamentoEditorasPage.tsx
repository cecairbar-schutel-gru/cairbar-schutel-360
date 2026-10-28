import { Button, Chip, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { DialogoTexto } from '../components/DialogoTexto'
import { deslocarMes, nomeDoMes } from '../regras'
import { editoraService } from '../services'
import type { ItemFechamento } from '../types'

/**
 * Etapa "Editoras" do fechamento mensal (US-PUBLISHER-010): cada editora com saldo no fim do mês é
 * paga ou tem o saldo transferido formalmente ao mês seguinte, com nota obrigatória. A transferência
 * não gera lançamento; as obrigações seguem abertas com as datas originais.
 */
export function FechamentoEditorasPage() {
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const atual = paraIsoData(hoje()).slice(0, 7)
  const mes = /^\d{4}-\d{2}$/.test(parametros.get('mes') ?? '') ? parametros.get('mes')! : deslocarMes(atual, -1)
  const { dados, carregando, erro, recarregar } = useCarregamento(() => editoraService.fechamento(mes), [mes])
  const [transferindo, setTransferindo] = useState<ItemFechamento | null>(null)
  const [nota, setNota] = useState('')
  const [erroNota, setErroNota] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const tesoureiro = possuiPapel('tesoureiro')
  const meses = Array.from({ length: 12 }, (_, i) => deslocarMes(atual, -i))

  async function transferir() {
    if (!transferindo) return
    setErroNota(null)
    try {
      await editoraService.transferirSaldo(transferindo.editoraId, mes, nota)
      setMensagem(`Saldo de ${transferindo.nome} transferido para ${nomeDoMes(deslocarMes(mes, 1))}.`)
      setTransferindo(null)
      setNota('')
      recarregar()
    } catch (f) {
      setErroNota(mensagemDeErro(f))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-fechamento-editoras">
      <LinhaAcoes>
        <LinkRota to="/editoras/saldos">Voltar aos saldos</LinkRota>
        <LinkRota to="/fechamento">Checklist do fechamento mensal</LinkRota>
      </LinhaAcoes>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-fechamento-editoras">Fechamento: editoras</TituloPagina>
        <TextField select size="small" label="Mês" value={mes} onChange={(e) => setParametros({ mes: e.target.value }, { replace: true })}>
          {meses.map((m) => (
            <MenuItem key={m} value={m}>
              {nomeDoMes(m)}
            </MenuItem>
          ))}
        </TextField>
      </LinhaAcoes>
      <TextoSuave>Toda editora com saldo devido no fim do mês precisa ser paga ou ter o saldo transferido formalmente ao mês seguinte.</TextoSuave>
      {mensagem && <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>{mensagem}</Aviso>}
      {carregando && <Carregando />}
      {erro && <Aviso tipo="error" titulo="Erro">{erro}</Aviso>}
      {dados && !carregando && (
        <>
          {dados.concluido ? (
            <Aviso tipo="success" titulo="Item “Editoras” concluído">
              {dados.editoras.length === 0
                ? `Nenhuma editora com saldo devido no fim de ${nomeDoMes(mes)}.`
                : 'Todos os saldos do mês foram pagos ou transferidos.'}
            </Aviso>
          ) : (
            <Aviso tipo="warning" titulo="Pendente">
              {dados.editoras.filter((e) => e.situacao === 'PENDENTE').length} editora(s) com saldo sem pagamento nem transferência.
            </Aviso>
          )}
          {dados.editoras.length > 0 && (
            <Table size="small" aria-label="Editoras com saldo no fim do mês">
              <TableHead>
                <TableRow>
                  <TableCell>Editora</TableCell>
                  <TableCell align="right">Saldo no fim do mês</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.editoras.map((e) => (
                  <TableRow key={e.editoraId}>
                    <TableCell>
                      <LinkRota to={`/editoras/${e.editoraId}/apuracao?mes=${mes}`}>{e.nome}</LinkRota>
                    </TableCell>
                    <TableCell align="right">{formatarMoeda(e.saldoNoFimDoMes)}</TableCell>
                    <TableCell>
                      {e.transferencia ? (
                        <>
                          <Chip size="small" variant="outlined" color="info" label="Transferido" />
                          <Typography variant="body2" color="text.secondary">
                            {e.transferencia.usuarioNome}, {formatarDataHora(e.transferencia.registradaEm)}: “{e.transferencia.nota}”
                          </Typography>
                        </>
                      ) : (
                        <Chip size="small" variant="outlined" color="warning" label="Pendente" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {tesoureiro && !e.transferencia && (
                        <LinhaAcoes sx={{ justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={() => navegar(`/editoras/pagamento?editoraId=${e.editoraId}`)}>
                            Pagar
                          </Button>
                          <Button size="small" variant="outlined" onClick={() => setTransferindo(e)}>
                            Transferir saldo
                          </Button>
                        </LinhaAcoes>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      <DialogoTexto
        aberto={transferindo !== null}
        titulo={`Transferir o saldo de ${transferindo?.nome ?? ''}`}
        descricao={`${formatarMoeda(transferindo?.saldoNoFimDoMes ?? 0)} passam para ${nomeDoMes(deslocarMes(mes, 1))} sem lançamento; as obrigações continuam abertas.`}
        rotulo="Nota (ex.: combinado com a editora pagar em 15/11)"
        textoConfirmar="Transferir"
        valor={nota}
        erro={erroNota}
        onAlterar={setNota}
        onFechar={() => setTransferindo(null)}
        onConfirmar={() => void transferir()}
      />
    </Pilha>
  )
}
