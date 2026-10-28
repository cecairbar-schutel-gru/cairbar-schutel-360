import { Button, Table, TableBody, TableCell, TableFooter, TableHead, TableRow } from '@mui/material'
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
import { editoraService } from '../services'

/**
 * Saldo devido por editora (US-PUBLISHER-006, Spec §8 "visibilidade do saldo devido às editoras"):
 * saldo, obrigação mais antiga em aberto e último pagamento, com o total de todas as editoras.
 */
export function SaldosEditorasPage() {
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const { dados, carregando, erro } = useCarregamento(() => editoraService.saldos(), [])
  const tesoureiro = possuiPapel('tesoureiro')
  const comSaldo = (dados?.editoras ?? []).filter((e) => e.saldoDevido > 0).length
  return (
    <Pilha component="section" aria-labelledby="titulo-saldos-editoras">
      <LinkRota to="/editoras">Voltar às editoras</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-saldos-editoras">Saldos das editoras</TituloPagina>
        <LinhaAcoes>
          <Button variant="outlined" onClick={() => navegar('/editoras/fechamento')}>
            Fechamento do mês
          </Button>
          {tesoureiro && (
            <Button variant="contained" onClick={() => navegar('/editoras/pagamento')}>
              Pagar editora
            </Button>
          )}
        </LinhaAcoes>
      </LinhaAcoes>
      <TextoSuave>Saldo devido = obrigações por vendas e baixas − estornos − pagamentos. Saldo negativo é crédito da editora.</TextoSuave>
      {carregando && <Carregando />}
      {erro && <Aviso tipo="error" titulo="Erro">{erro}</Aviso>}
      {dados && (
        <>
          <GradeForm>
            <Indicador rotulo="Total devido às editoras" valor={formatarMoeda(dados.total)} destaque={dados.total > 0 ? 'warning' : undefined} />
            <Indicador rotulo="Editoras com saldo" valor={String(comSaldo)} />
          </GradeForm>
          {dados.editoras.length === 0 ? (
            <TextoSuave>Nenhuma obrigação com editoras até agora.</TextoSuave>
          ) : (
            <Table size="small" aria-label="Saldo por editora">
              <TableHead>
                <TableRow>
                  <TableCell>Editora</TableCell>
                  <TableCell align="right">Saldo devido</TableCell>
                  <TableCell>Obrigação mais antiga</TableCell>
                  <TableCell>Último pagamento</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.editoras.map((e) => (
                  <TableRow key={e.editoraId} hover>
                    <TableCell>
                      <LinkRota to={`/editoras/${e.editoraId}/saldo`}>{e.nome}</LinkRota>
                    </TableCell>
                    <TableCell align="right">{formatarMoeda(e.saldoDevido)}</TableCell>
                    <TableCell>{formatarData(e.obrigacaoMaisAntiga)}</TableCell>
                    <TableCell>{formatarData(e.ultimoPagamento)}</TableCell>
                    <TableCell align="right">
                      {tesoureiro && e.saldoDevido > 0 && (
                        <Button size="small" onClick={() => navegar(`/editoras/pagamento?editoraId=${e.editoraId}`)}>
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell align="right">{formatarMoeda(dados.total)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </>
      )}
    </Pilha>
  )
}
