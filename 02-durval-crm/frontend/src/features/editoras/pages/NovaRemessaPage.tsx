import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { percentualValido } from '../regras'
import { editoraService } from '../services'
import type { TituloConsignado } from '../types'

interface Linha {
  chave: number
  produtoId: number | ''
  quantidade: string
  repasse: string
}

let proximaChave = 1
const novaLinha = (): Linha => ({ chave: proximaChave++, produtoId: '', quantidade: '1', repasse: '' })
const lerNumero = (texto: string) => Number(texto.replace(',', '.'))

/**
 * Registro de remessa (US-PUBLISHER-003, Vendedor ou Administrador): editora, data de recebimento,
 * documento e títulos com quantidade e percentual de repasse (o padrão do título vem preenchido).
 * Pode atender um pedido de livros aberto da editora: os títulos pedidos vêm preenchidos para a
 * conferência. Depois de gravada, itens e percentuais não mudam; o código é gerado pelo sistema.
 */
export function NovaRemessaPage() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [editoraId, setEditoraId] = useState<number | ''>(Number(parametros.get('editoraId')) || '')
  const [recebidaEm, setRecebidaEm] = useState(paraIsoData(hoje()))
  const [documento, setDocumento] = useState('')
  const [pedidoId, setPedidoId] = useState<number | ''>(Number(parametros.get('pedidoId')) || '')
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const editoras = useCarregamento(() => editoraService.listar('ATIVAS'), [])
  const titulos = useCarregamento(
    () => (editoraId ? editoraService.titulos(editoraId) : Promise.resolve([] as TituloConsignado[])),
    [editoraId],
  )
  const pedidosAbertos = useCarregamento(
    () => (editoraId ? editoraService.pedidos({ editoraId, situacao: 'ABERTO' }) : Promise.resolve([])),
    [editoraId],
  )
  // Ao escolher o pedido (ou vir dele), os títulos pedidos preenchem as linhas para a conferência.
  const pedido = useCarregamento(
    () =>
      pedidoId
        ? editoraService.pedido(pedidoId).then((p) => {
            setLinhas(p.itens.map((i) => ({ ...novaLinha(), produtoId: i.produtoId, quantidade: String(i.pedida), repasse: '' })))
            return p
          })
        : Promise.resolve(null),
    [pedidoId],
  )
  const disponiveis = (titulos.dados ?? []).filter((t) => t.ativo)
  const titulo = (id: number | '') => disponiveis.find((t) => t.produtoId === id)
  const alterar = (chave: number, parcial: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)))
  // Linha vinda do pedido: o repasse padrão do título entra quando o catálogo carrega.
  const repasseDa = (l: Linha) => l.repasse || (titulo(l.produtoId)?.repassePadrao?.toString() ?? '')
  const totalUnidades = linhas.reduce((s, l) => s + (Number.parseInt(l.quantidade, 10) || 0), 0)

  function trocarEditora(id: number) {
    setEditoraId(id)
    setPedidoId('')
    setLinhas([novaLinha()])
    setErros({})
  }

  function validar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!editoraId) locais.editoraId = 'Escolha a editora.'
    if (!recebidaEm) locais.recebidaEm = 'Informe a data de recebimento.'
    else if (recebidaEm > paraIsoData(hoje())) locais.recebidaEm = 'A data de recebimento não pode ser futura.'
    const vistos = new Set<number>()
    for (const l of linhas) {
      const campo = `linha-${l.chave}`
      const t = titulo(l.produtoId)
      const quantidade = Number(l.quantidade)
      if (!t) locais[campo] = 'Escolha o título.'
      else if (vistos.has(t.produtoId)) locais[campo] = `${t.nome} aparece mais de uma vez.`
      else if (!Number.isInteger(quantidade) || quantidade <= 0) locais[campo] = 'Informe a quantidade (maior que zero).'
      else if (!repasseDa(l).trim()) locais[campo] = 'Informe o percentual de repasse.'
      else if (!percentualValido(lerNumero(repasseDa(l)))) locais[campo] = 'O percentual vai de 0 a 100, com até duas casas.'
      if (t) vistos.add(t.produtoId)
    }
    if (linhas.length === 0) locais.itens = 'Inclua ao menos um título.'
    setErros(locais)
    if (Object.keys(locais).length === 0) setConfirmando(true)
  }

  async function enviar() {
    setConfirmando(false)
    setErro(null)
    try {
      const r = await editoraService.registrarRemessa({
        editoraId: Number(editoraId),
        recebidaEm,
        numeroDocumento: documento,
        itens: linhas.map((l) => ({ produtoId: Number(l.produtoId), quantidade: Number(l.quantidade), repassePercentual: lerNumero(repasseDa(l)) })),
        pedidoId: pedidoId || null,
      })
      navegar(`/editoras/remessas/${r.id}?nova=1`)
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
    }
  }

  const nomeEditora = editoras.dados?.find((e) => e.id === editoraId)?.nome
  return (
    <Pilha component="section" aria-labelledby="titulo-nova-remessa">
      <LinkRota to="/editoras?aba=remessas">Voltar às remessas</LinkRota>
      <TituloPagina id="titulo-nova-remessa">Registrar remessa</TituloPagina>
      <TextoSuave>
        As unidades entram no estoque como consignadas desta remessa. Depois de gravada, títulos, quantidades e percentuais não
        mudam: um erro se corrige cancelando a remessa (enquanto nenhuma unidade se moveu) e registrando de novo.
      </TextoSuave>
      {erro && <Aviso tipo="error" titulo="Não foi possível registrar">{erro}</Aviso>}
      {editoras.erro && <Aviso tipo="error" titulo="Erro">{editoras.erro}</Aviso>}
      <Pilha component="form" onSubmit={validar} noValidate spacing={2} aria-label="Nova remessa">
        <GradeForm>
          <TextField select label="Editora" required value={editoraId} onChange={(e) => trocarEditora(Number(e.target.value))}
            error={!!erros.editoraId} helperText={erros.editoraId ?? ' '}>
            {(editoras.dados ?? []).map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField type="date" label="Recebida em" required value={recebidaEm} onChange={(e) => setRecebidaEm(e.target.value)}
            error={!!erros.recebidaEm} helperText={erros.recebidaEm ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
          <TextField select label="Pedido atendido (opcional)" value={pedidoId} disabled={!editoraId}
            onChange={(e) => {
              const id = Number(e.target.value) || ''
              setPedidoId(id)
              if (!id) setLinhas([novaLinha()])
            }}
            error={!!erros.pedidoId} helperText={erros.pedidoId ?? 'Os títulos pedidos vêm preenchidos; ajuste ao que chegou.'}>
            <MenuItem value="">Sem pedido</MenuItem>
            {(pedidosAbertos.dados ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                Nº {p.id} — {p.unidades} unidade(s), pedido por {p.pedidoPor}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Documento da editora (opcional)" value={documento} onChange={(e) => setDocumento(e.target.value)}
            helperText={erros.numeroDocumento ?? 'Ex.: número da nota de remessa.'} error={!!erros.numeroDocumento}
            slotProps={{ htmlInput: { maxLength: 60 } }} />
        </GradeForm>
        {editoraId !== '' && !titulos.carregando && disponiveis.length === 0 && (
          <Aviso tipo="warning" titulo="Sem títulos">
            Esta editora não tem títulos ativos no catálogo. Cadastre os livros no Estoque antes de registrar a remessa.
          </Aviso>
        )}
        <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Títulos da remessa">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: '12rem' }}>Título</TableCell>
              <TableCell sx={{ width: '7rem', minWidth: '6rem' }}>Qtd.</TableCell>
              <TableCell sx={{ width: '9rem', minWidth: '7.5rem' }}>Repasse</TableCell>
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
                    onChange={(e) => {
                      const t = titulo(Number(e.target.value))
                      alterar(l.chave, { produtoId: Number(e.target.value), repasse: t?.repassePadrao != null ? String(t.repassePadrao) : '' })
                    }}
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
                  <TextField size="small" fullWidth label="Qtd." value={l.quantidade} onChange={(e) => alterar(l.chave, { quantidade: e.target.value })}
                    helperText=" " slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'Quantidade' } }} />
                </TableCell>
                <TableCell>
                  <TextField size="small" fullWidth label="Repasse" value={repasseDa(l)} onChange={(e) => alterar(l.chave, { repasse: e.target.value })}
                    helperText=" " slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { inputMode: 'decimal' } }} />
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
              <TableCell colSpan={3}>Total: {totalUnidades} unidade(s)</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        </Box>
        <LinhaAcoes>
          <Button onClick={() => navegar('/editoras?aba=remessas')}>Cancelar</Button>
          <Button type="submit" variant="contained">
            Registrar remessa
          </Button>
        </LinhaAcoes>
      </Pilha>
      <DialogoAcao
        aberto={confirmando}
        titulo="Confirmar remessa"
        textoConfirmar="Registrar"
        onFechar={() => setConfirmando(false)}
        onConfirmar={() => void enviar()}
      >
        <TextoSuave>
          {totalUnidades} unidade(s) de {nomeEditora}, recebidas em {formatarData(recebidaEm)}
          {pedido.dados ? `, atendendo o pedido nº ${pedido.dados.id}` : ''}. Títulos, quantidades e percentuais
          não poderão ser alterados depois.
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
