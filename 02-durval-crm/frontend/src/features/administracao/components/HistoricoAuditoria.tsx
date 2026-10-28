import HistoryIcon from '@mui/icons-material/History'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { useId, useState } from 'react'
import { ROTULO_PAPEL } from '../../../auth'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useTelaCheia } from '../../../shared/hooks/useTelaCheia'
import { rotuloAcao } from '../rotulos'
import { administracaoService } from '../services'
import { DetalhesAuditoria } from './DetalhesAuditoria'

/**
 * "Histórico" das páginas de detalhe (US-ADMIN-009): os registros de auditoria da própria entidade,
 * do mais recente ao mais antigo. De doador anonimizado não aparecem os dados pessoais.
 */
export function BotaoHistorico({ entidade, id }: { entidade: string; id: string | number }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button startIcon={<HistoryIcon />} onClick={() => setAberto(true)}>
        Histórico
      </Button>
      {aberto && <DialogoHistorico entidade={entidade} id={id} onFechar={() => setAberto(false)} />}
    </>
  )
}

function DialogoHistorico({ entidade, id, onFechar }: { entidade: string; id: string | number; onFechar(): void }) {
  const titulo = useId()
  const telaCheia = useTelaCheia()
  const eventos = useCarregamento(() => administracaoService.historico(entidade, id), [entidade, id])
  return (
    <Dialog open onClose={onFechar} aria-labelledby={titulo} fullScreen={telaCheia} fullWidth maxWidth="md">
      <DialogTitle id={titulo}>Histórico</DialogTitle>
      <DialogContent>
        {eventos.carregando && <Carregando linhas={3} />}
        {eventos.erro && (
          <Aviso tipo="error" titulo="Erro">
            {eventos.erro}
          </Aviso>
        )}
        {eventos.dados?.length === 0 && <TextoSuave>Nenhum registro de auditoria.</TextoSuave>}
        {eventos.dados && eventos.dados.length > 0 && (
          <TableContainer>
            <Table size="small" aria-label="Registros de auditoria">
              <TableHead>
                <TableRow>
                  <TableCell>Data e hora</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Detalhes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eventos.dados.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatarDataHora(e.em)}</TableCell>
                    <TableCell>
                      {e.autorNome ?? e.autorSubject}
                      {e.perfil && ` (${ROTULO_PAPEL[e.perfil]})`}
                    </TableCell>
                    <TableCell>{rotuloAcao(e.acao)}</TableCell>
                    <TableCell>
                      <DetalhesAuditoria detalhes={e.detalhes} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
