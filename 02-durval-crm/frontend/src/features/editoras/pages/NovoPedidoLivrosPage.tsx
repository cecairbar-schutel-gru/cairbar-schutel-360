import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, IconButton, MenuItem, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { editoraService } from '../services'
import type { TituloConsignado } from '../types'

interface Linha {
  chave: number
  produtoId: number | ''
  quantidade: string
}

let proximaChave = 1
const novaLinha = (): Linha => ({ chave: proximaChave++, produtoId: '', quantidade: '1' })

/**
 * Novo pedido de livros (Tesoureiro ou Administrador): editora, títulos do catálogo e quantidades.
 * Não gera despesa; o Vendedor registra a remessa contra o pedido quando os livros chegam.
 */
export function NovoPedidoLivrosPage() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [editoraId, setEditoraId] = useState<number | ''>(Number(parametros.get('editoraId')) || '')
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const editoras = useCarregamento(() => editoraService.listar('ATIVAS'), [])
  const titulos = useCarregamento(
    () => (editoraId ? editoraService.titulos(editoraId) : Promise.resolve([] as TituloConsignado[])),
    [editoraId],
  )
  const disponiveis = (titulos.dados ?? []).filter((t) => t.ativo)
  const titulo = (id: number | '') => disponiveis.find((t) => t.produtoId === id)
  const alterar = (chave: number, parcial: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)))
  const totalUnidades = linhas.reduce((s, l) => s + (Number.parseInt(l.quantidade, 10) || 0), 0)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!editoraId) locais.editoraId = 'Escolha a editora.'
    const vistos = new Set<number>()
    for (const l of linhas) {
      const campo = `linha-${l.chave}`
      const t = titulo(l.produtoId)
      const quantidade = Number(l.quantidade)
      if (!t) locais[campo] = 'Escolha o título.'
      else if (vistos.has(t.produtoId)) locais[campo] = `${t.nome} aparece mais de uma vez.`
      else if (!Number.isInteger(quantidade) || quantidade <= 0) locais[campo] = 'Informe a quantidade (maior que zero).'
      if (t) vistos.add(t.produtoId)
    }
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    setErro(null)
    try {
      const p = await editoraService.pedir({
        editoraId: Number(editoraId),
        observacao,
        itens: linhas.map((l) => ({ produtoId: Number(l.produtoId), quantidade: Number(l.quantidade) })),
      })
      navegar(`/editoras/pedidos/${p.id}?novo=1`)
    } catch (falha) {
      const porCampo = errosPorCampo(falha)
      setErros(
        Object.fromEntries(
          Object.entries(porCampo).map(([campo, msg]) => {
            const linha = linhas.find((l) => campo === `itens[${l.produtoId}]`)
            return [linha ? `linha-${linha.chave}` : campo, msg]
          }),
        ),
      )
      setErro(mensagemDeErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-novo-pedido">
      <LinkRota to="/editoras/pedidos">Voltar aos pedidos</LinkRota>
      <TituloPagina id="titulo-novo-pedido">Novo pedido de livros</TituloPagina>
      <TextoSuave>
        Os livros são consignados: o pedido não gera despesa. Quando a editora entregar, o Vendedor registra a remessa contra
        este pedido e confere as quantidades.
      </TextoSuave>
      {erro && <Aviso tipo="error" titulo="Não foi possível registrar o pedido">{erro}</Aviso>}
      {editoras.erro && <Aviso tipo="error" titulo="Erro">{editoras.erro}</Aviso>}
      <Pilha component="form" onSubmit={(e) => void enviar(e)} noValidate spacing={2} aria-label="Novo pedido de livros">
        <GradeForm>
          <TextField select label="Editora" required value={editoraId}
            onChange={(e) => { setEditoraId(Number(e.target.value)); setLinhas([novaLinha()]); setErros({}) }}
            error={!!erros.editoraId} helperText={erros.editoraId ?? ' '}>
            {(editoras.dados ?? []).map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)}
            error={!!erros.observacao} helperText={erros.observacao ?? ' '} slotProps={{ htmlInput: { maxLength: 500 } }} />
        </GradeForm>
        {editoraId !== '' && !titulos.carregando && disponiveis.length === 0 && (
          <Aviso tipo="warning" titulo="Sem títulos">
            Esta editora não tem títulos ativos no catálogo. O Vendedor cadastra os livros no Estoque.
          </Aviso>
        )}
        <Table size="small" aria-label="Títulos do pedido">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell sx={{ width: '8rem' }}>Qtd.</TableCell>
              <TableCell align="right" sx={{ width: '4rem' }}>
                Remover
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={l.chave}>
                <TableCell>
                  <TextField select fullWidth size="small" label={`Título da linha ${i + 1}`} value={l.produtoId} disabled={!editoraId}
                    onChange={(e) => alterar(l.chave, { produtoId: Number(e.target.value) })}
                    error={!!erros[`linha-${l.chave}`]} helperText={erros[`linha-${l.chave}`] ?? ' '}>
                    {disponiveis.map((t) => (
                      <MenuItem key={t.produtoId} value={t.produtoId}>
                        {t.nome}
                        {t.autor ? ` — ${t.autor}` : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField size="small" label="Quantidade" value={l.quantidade} onChange={(e) => alterar(l.chave, { quantidade: e.target.value })}
                    helperText=" " slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label={`Remover a linha ${i + 1}`} onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                    disabled={linhas.length === 1}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>
                <Button startIcon={<AddIcon />} onClick={() => setLinhas((ls) => [...ls, novaLinha()])} disabled={!editoraId}>
                  Adicionar título
                </Button>
              </TableCell>
              <TableCell colSpan={2}>Total: {totalUnidades} unidade(s)</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <LinhaAcoes>
          <Button onClick={() => navegar('/editoras/pedidos')}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={enviando}>
            Registrar pedido
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
