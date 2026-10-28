import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { ROTULO_PAPEL } from '../../../auth'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { administracaoService } from '../services'

/** Usuários e papéis (US-ADMIN-001): lista só de leitura do realm do Keycloak. Criar, alterar e excluir é no Keycloak. */
export function UsuariosPage() {
  const lista = useCarregamento(() => administracaoService.usuarios(), [])
  return (
    <Pilha component="section" aria-labelledby="titulo-usuarios">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-usuarios">Usuários</TituloPagina>
      <TextoSuave>
        O DurvalCRM não cria, altera nem exclui usuários ou papéis: use “Gerenciar no Keycloak”. Quem pode vender
        registra a venda direto; cada forma de pagamento entra na conta de recebimento definida em Financeiro › Contas.
      </TextoSuave>
      {lista.carregando && <Carregando />}
      {lista.erro && (
        <Aviso tipo="error" titulo="Erro">
          {lista.erro}
        </Aviso>
      )}
      {lista.dados && !lista.dados.configurado && (
        <Aviso tipo="info" titulo="Leitura do Keycloak não configurada">
          Informe o segredo do client durvalcrm-api (DURVALCRM_KEYCLOAK_CLIENT_SECRET) e dê à conta de serviço os papéis
          view-users, view-clients e view-events de realm-management.
        </Aviso>
      )}
      {lista.dados?.erro && (
        <Aviso tipo="warning" titulo="Keycloak indisponível">
          {lista.dados.erro}
        </Aviso>
      )}
      {lista.dados && lista.dados.usuarios.length > 0 && (
        <Table size="small" aria-label="Usuários do DurvalCRM">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Papéis</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Último acesso</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.dados.usuarios.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Typography variant="body2">{u.nome}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.usuario}
                  </Typography>
                </TableCell>
                <TableCell>{u.email || '—'}</TableCell>
                <TableCell>{u.papeis.map((p) => ROTULO_PAPEL[p] ?? p).join(', ')}</TableCell>
                <TableCell>
                  <Chip size="small" color={u.habilitado ? 'success' : 'default'} label={u.habilitado ? 'Habilitado' : 'Desabilitado'} />
                </TableCell>
                <TableCell>{u.ultimoLogin ? formatarDataHora(u.ultimoLogin) : '—'}</TableCell>
                <TableCell>
                  <Button size="small" href={u.linkConsole} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon />}>
                    Gerenciar no Keycloak
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {lista.dados?.configurado && !lista.dados.erro && lista.dados.usuarios.length === 0 && (
        <TextoSuave>Nenhum usuário com papel do DurvalCRM no realm.</TextoSuave>
      )}
    </Pilha>
  )
}
