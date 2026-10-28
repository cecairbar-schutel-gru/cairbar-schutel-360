import { Button, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { ROTULO_PAPEL } from '../../../auth'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { DetalhesAuditoria } from '../components/DetalhesAuditoria'
import { rotuloAcao, rotuloEntidade } from '../rotulos'
import { administracaoService } from '../services'
import type { FiltroAuditoria } from '../types'

const CAMPOS = ['de', 'ate', 'usuario', 'acao', 'entidade', 'entidadeId'] as const

/**
 * Log de auditoria (US-ADMIN-009): só leitura (não há como alterar nem excluir registros), mais
 * recentes primeiro, com filtros de período, usuário, ação, tipo e id da entidade guardados na URL.
 */
export function AuditoriaPage() {
  const [parametros, setParametros] = useSearchParams()
  const filtro: FiltroAuditoria = Object.fromEntries(CAMPOS.map((c) => [c, parametros.get(c) ?? undefined]))
  const pagina = Number(parametros.get('pagina') ?? 1)
  const chave = parametros.toString()
  const opcoes = useCarregamento(() => administracaoService.opcoesAuditoria(), [])
  const eventos = useCarregamento(() => administracaoService.auditoria(filtro, pagina), [chave])

  function alterar(campo: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(campo, valor)
    else novos.delete(campo)
    novos.delete('pagina')
    setParametros(novos, { replace: true })
  }

  function irPara(p: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('pagina', String(p))
    setParametros(novos)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-auditoria">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-auditoria">Auditoria</TituloPagina>
      <TextoSuave>
        Cada cadastro, mudança de situação, cancelamento, estorno, aprovação, reclassificação, configuração, fechamento,
        exportação e entrada no sistema fica registrado com quem fez, quando, com qual perfil e de qual endereço.
      </TextoSuave>
      <GradeForm role="search" aria-label="Filtros da auditoria">
        <TextField label="De" type="date" value={filtro.de ?? ''} onChange={(e) => alterar('de', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Até" type="date" value={filtro.ate ?? ''} onChange={(e) => alterar('ate', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Usuário" value={filtro.usuario ?? ''} onChange={(e) => alterar('usuario', e.target.value)} />
        <TextField select label="Ação" value={filtro.acao ?? ''} onChange={(e) => alterar('acao', e.target.value)}>
          <MenuItem value="">Todas</MenuItem>
          {(opcoes.dados?.acoes ?? []).map((a) => (
            <MenuItem key={a} value={a}>
              {rotuloAcao(a)}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Tipo de registro" value={filtro.entidade ?? ''} onChange={(e) => alterar('entidade', e.target.value)}>
          <MenuItem value="">Todos</MenuItem>
          {(opcoes.dados?.entidades ?? []).map((a) => (
            <MenuItem key={a} value={a}>
              {rotuloEntidade(a)}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Id do registro" value={filtro.entidadeId ?? ''} onChange={(e) => alterar('entidadeId', e.target.value)} />
      </GradeForm>
      {eventos.carregando && <Carregando />}
      {eventos.erro && (
        <Aviso tipo="error" titulo="Erro">
          {eventos.erro}
        </Aviso>
      )}
      {eventos.dados && eventos.dados.itens.length === 0 && <TextoSuave>Nenhum registro com esses filtros.</TextoSuave>}
      {eventos.dados && eventos.dados.itens.length > 0 && (
        <Table size="small" aria-label="Registros de auditoria">
          <TableHead>
            <TableRow>
              <TableCell>Data e hora</TableCell>
              <TableCell>Usuário</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Registro</TableCell>
              <TableCell>Detalhes</TableCell>
              <TableCell>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {eventos.dados.itens.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataHora(e.em)}</TableCell>
                <TableCell>{e.autorNome ?? e.autorSubject}</TableCell>
                <TableCell>{e.perfil ? ROTULO_PAPEL[e.perfil] : '—'}</TableCell>
                <TableCell>{rotuloAcao(e.acao)}</TableCell>
                <TableCell>
                  {rotuloEntidade(e.entidade)} {e.entidadeId !== '-' && <code>{e.entidadeId}</code>}
                </TableCell>
                <TableCell>
                  <DetalhesAuditoria detalhes={e.detalhes} />
                </TableCell>
                <TableCell>{e.ip ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {eventos.dados && (pagina > 1 || eventos.dados.temMais) && (
        <LinhaAcoes>
          <Button disabled={pagina <= 1} onClick={() => irPara(pagina - 1)}>
            Anteriores
          </Button>
          <TextoSuave>Página {pagina}</TextoSuave>
          <Button disabled={!eventos.dados.temMais} onClick={() => irPara(pagina + 1)}>
            Próximos 50
          </Button>
        </LinhaAcoes>
      )}
    </Pilha>
  )
}
