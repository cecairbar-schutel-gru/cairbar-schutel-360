import AddIcon from '@mui/icons-material/Add'
import {
  Button,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Fragment, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import type { TipoCategoria } from '../../financeiro/types'
import { administracaoService } from '../services'
import type { CategoriaPlano } from '../types'

type Acao =
  | { tipo: 'nova'; pai: CategoriaPlano | null }
  | { tipo: 'renomear' | 'inativar' | 'reativar' | 'excluir'; categoria: CategoriaPlano }

const ROTULO_TIPO: Record<TipoCategoria, string> = { RECEITA: 'Receita', DESPESA: 'Despesa' }

/**
 * Plano de contas (US-ADMIN-004, Spec §5): categoria → subcategoria, tipo herdado, "Sistema" só se
 * renomeia, usadas só se inativam e inativas somem dos formulários (mas seguem nos relatórios).
 */
export function PlanoContasPage() {
  const { perfilAtivo } = useAuth()
  const admin = perfilAtivo === 'administrador'
  const plano = useCarregamento(() => administracaoService.planoDeContas(), [])
  const [acao, setAcao] = useState<Acao | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoCategoria>('DESPESA')
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  function abrir(a: Acao) {
    setAcao(a)
    setErro(null)
    setNome(a.tipo === 'renomear' ? a.categoria.nome : '')
  }

  async function confirmar() {
    if (!acao) return
    setErro(null)
    try {
      if (acao.tipo === 'nova') {
        const c = await administracaoService.criarCategoria(acao.pai ? { nome, categoriaPai: acao.pai.codigo } : { nome, tipo })
        setMensagem(`${c.nome} incluída.`)
      } else if (acao.tipo === 'renomear') {
        await administracaoService.renomearCategoria(acao.categoria.codigo, nome)
        setMensagem(`${acao.categoria.nome} renomeada para ${nome.trim()}.`)
      } else if (acao.tipo === 'inativar') {
        const lista = await administracaoService.inativarCategoria(acao.categoria.codigo)
        setMensagem(`Inativadas: ${lista.map((c) => c.nome).join(', ')}.`)
      } else if (acao.tipo === 'reativar') {
        await administracaoService.reativarCategoria(acao.categoria.codigo)
        setMensagem(`${acao.categoria.nome} reativada.`)
      } else {
        await administracaoService.excluirCategoria(acao.categoria.codigo)
        setMensagem(`${acao.categoria.nome} excluída.`)
      }
      setAcao(null)
      plano.recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    }
  }

  const acoes = (c: CategoriaPlano, subcategorias: CategoriaPlano[] = []) => (
    <LinhaAcoes>
      <Button size="small" onClick={() => abrir({ tipo: 'renomear', categoria: c })}>
        Renomear
      </Button>
      {c.ativa && !c.sistema && (
        <Button size="small" onClick={() => abrir({ tipo: 'inativar', categoria: c })}>
          Inativar
        </Button>
      )}
      {!c.ativa && (
        <Button size="small" onClick={() => abrir({ tipo: 'reativar', categoria: c })}>
          Reativar
        </Button>
      )}
      {!c.sistema && !c.emUso && subcategorias.length === 0 && (
        <Button size="small" color="error" onClick={() => abrir({ tipo: 'excluir', categoria: c })}>
          Excluir
        </Button>
      )}
    </LinhaAcoes>
  )

  const situacao = (c: CategoriaPlano) => (
    <Stack direction="row" spacing={0.5}>
      <Chip size="small" color={c.ativa ? 'success' : 'default'} label={c.ativa ? 'Ativa' : 'Inativa'} />
      {c.sistema && <Chip size="small" variant="outlined" label="Sistema" />}
      {c.emUso && <Chip size="small" variant="outlined" label="Em uso" />}
    </Stack>
  )

  const titulo =
    acao === null
      ? ''
      : acao.tipo === 'nova'
        ? acao.pai
          ? `Nova subcategoria em ${acao.pai.nome}`
          : 'Nova categoria'
        : { renomear: 'Renomear', inativar: 'Inativar', reativar: 'Reativar', excluir: 'Excluir' }[acao.tipo]

  return (
    <Pilha component="section" aria-labelledby="titulo-plano">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id="titulo-plano">Plano de contas</TituloPagina>
        {admin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrir({ tipo: 'nova', pai: null })}>
            Nova categoria
          </Button>
        )}
      </LinhaAcoes>
      <TextoSuave>
        Todo lançamento usa uma subcategoria. As marcadas “Sistema” são usadas pelos lançamentos automáticos e só podem
        ser renomeadas. O que já foi usado não se exclui: inative, e ele deixa de aparecer nos formulários.
      </TextoSuave>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      {plano.carregando && <Carregando />}
      {plano.erro && (
        <Aviso tipo="error" titulo="Erro">
          {plano.erro}
        </Aviso>
      )}
      {plano.dados && (
        <Table size="small" aria-label="Plano de contas">
          <TableHead>
            <TableRow>
              <TableCell>Categoria / subcategoria</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Situação</TableCell>
              {admin && <TableCell>Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {plano.dados.map(({ categoria, subcategorias }) => (
              <Fragment key={categoria.codigo}>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell>
                    <Typography variant="subtitle2" component="span">
                      {categoria.nome}
                    </Typography>
                  </TableCell>
                  <TableCell>{ROTULO_TIPO[categoria.tipo]}</TableCell>
                  <TableCell>{situacao(categoria)}</TableCell>
                  {admin && (
                    <TableCell>
                      <LinhaAcoes>
                        {acoes(categoria, subcategorias)}
                        {categoria.ativa && (
                          <Button size="small" startIcon={<AddIcon />} onClick={() => abrir({ tipo: 'nova', pai: categoria })}>
                            Subcategoria
                          </Button>
                        )}
                      </LinhaAcoes>
                    </TableCell>
                  )}
                </TableRow>
                {subcategorias.map((s) => (
                  <TableRow key={s.codigo} hover>
                    <TableCell sx={{ pl: 5 }}>{s.nome}</TableCell>
                    <TableCell>{ROTULO_TIPO[s.tipo]}</TableCell>
                    <TableCell>{situacao(s)}</TableCell>
                    {admin && <TableCell>{acoes(s)}</TableCell>}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
      {acao && (
        <DialogoAcao
          aberto
          rotulo={acao.tipo === 'nova' ? undefined : acao.categoria.nome}
          titulo={titulo}
          textoConfirmar={acao.tipo === 'nova' ? 'Incluir' : titulo}
          perigo={acao.tipo === 'inativar' || acao.tipo === 'excluir'}
          confirmarDesabilitado={(acao.tipo === 'nova' || acao.tipo === 'renomear') && !nome.trim()}
          onFechar={() => setAcao(null)}
          onConfirmar={() => void confirmar()}
        >
          <Pilha spacing={2}>
            {erro && (
              <Aviso tipo="error" titulo="Não foi possível concluir">
                {erro}
              </Aviso>
            )}
            {(acao.tipo === 'nova' || acao.tipo === 'renomear') && (
              <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus fullWidth />
            )}
            {acao.tipo === 'nova' && !acao.pai && (
              <TextField select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)} fullWidth>
                <MenuItem value="RECEITA">Receita</MenuItem>
                <MenuItem value="DESPESA">Despesa</MenuItem>
              </TextField>
            )}
            {acao.tipo === 'nova' && acao.pai && <TextoSuave>O tipo é herdado da categoria: {ROTULO_TIPO[acao.pai.tipo]}.</TextoSuave>}
            {acao.tipo === 'inativar' && (
              <TextoSuave>
                Deixa de aparecer nos formulários, mas continua nos relatórios.
                {!acao.categoria.categoriaPai && ' As subcategorias ativas também são inativadas.'}
              </TextoSuave>
            )}
            {acao.tipo === 'reativar' && <TextoSuave>Volta a aparecer nos formulários.</TextoSuave>}
            {acao.tipo === 'excluir' && <TextoSuave>Nunca foi usada e será removida definitivamente.</TextoSuave>}
          </Pilha>
        </DialogoAcao>
      )}
    </Pilha>
  )
}
