import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText } from '@mui/material'
import { useId } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useTelaCheia } from '../../../shared/hooks/useTelaCheia'
import { nomeDoMes } from '../../financeiro/regras'
import { ROTULO_EVENTO } from '../rotulos'
import { fechamentoService } from '../services'

/** Histórico do período (US-CLOSING-009): cada fechamento e reabertura, com as versões gravadas. */
export function HistoricoDialogo({ mes, onFechar }: { mes: string; onFechar(): void }) {
  const idTitulo = useId()
  const telaCheia = useTelaCheia()
  const { dados, carregando, erro } = useCarregamento(() => fechamentoService.historico(mes), [mes])
  return (
    <Dialog open onClose={onFechar} aria-labelledby={idTitulo} fullScreen={telaCheia} fullWidth maxWidth="sm">
      <DialogTitle id={idTitulo}>Histórico de {nomeDoMes(mes)}</DialogTitle>
      <DialogContent>
        {carregando && <Carregando />}
        {erro && (
          <Aviso tipo="error" titulo="Erro">
            {erro}
          </Aviso>
        )}
        {dados && dados.eventos.length === 0 && <TextoSuave>Nenhum fechamento registrado.</TextoSuave>}
        {dados && dados.eventos.length > 0 && (
          <List dense aria-label="Eventos do período">
            {dados.eventos.map((e, i) => (
              <ListItem key={i} disableGutters divider>
                <ListItemText
                  primary={
                    <>
                      {ROTULO_EVENTO[e.evento]}
                      {e.versao !== null && (
                        <>
                          {' · '}
                          <LinkRota to={`/fechamento/${mes}/demonstrativo?versao=${e.versao}`}>versão {e.versao}</LinkRota>
                        </>
                      )}
                    </>
                  }
                  secondary={`${formatarDataHora(e.autor.em)} · ${e.autor.nome ?? e.autor.subject}${e.texto ? ` · “${e.texto}”` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}
