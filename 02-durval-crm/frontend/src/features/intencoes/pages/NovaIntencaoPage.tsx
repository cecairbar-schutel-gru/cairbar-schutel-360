import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Fieldset, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraReais, paraTextoDigitado, paraCentavos } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { SeletorCategoria } from '../../financeiro/components/SeletorCategoria'
import type { Categoria } from '../../financeiro/types'
import { erroAnexos, lerAnexo } from '../regras'
import { intencaoService } from '../services'
import { MAXIMO_ANEXOS, type CategoriaOpcao } from '../types'

/** Duas colunas como no wireframe 11 (uma no celular). */
const Grade = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(2),
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
}))

interface LinhaItem {
  chave: number
  produtoId: number | ''
  quantidade: string
}

/** O seletor do Financeiro trabalha com o plano de contas; aqui só vêm as subcategorias disponíveis. */
const paraCategoria = (c: CategoriaOpcao): Categoria => ({
  codigo: c.codigo,
  nome: c.nome,
  tipo: 'DESPESA',
  categoriaPai: c.categoriaPai,
  nomeCompleto: c.nomeCompleto,
  ativa: true,
  permiteManual: true,
})

let proximaChave = 1

/**
 * Nova intenção de gasto (wireframe 11, US-EXPENSE-001): descrição, categoria e subcategoria,
 * valor estimado, justificativa e até 5 anexos. Na compra de produtos da cantina, a lista de
 * produtos e quantidades é obrigatória; o valor continua sendo um total único. "Copiar como nova"
 * (US-EXPENSE-005) chega aqui com `?copiar=<nº>`.
 */
export function NovaIntencaoPage() {
  const navegar = useNavigate()
  const [busca] = useSearchParams()
  const copiar = Number(busca.get('copiar')) || null
  const opcoes = useCarregamento(() => intencaoService.opcoes(), [])
  const [campos, setCampos] = useState({ descricao: '', categoria: '', valor: '', justificativa: '' })
  const [itens, setItens] = useState<LinhaItem[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [versao, setVersao] = useState(0)
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  useEffect(() => {
    if (!copiar) return
    let ativo = true
    intencaoService.intencao(copiar).then(
      (i) => {
        if (!ativo) return
        setCampos({
          descricao: i.descricao,
          categoria: i.categoria,
          valor: paraTextoDigitado(paraCentavos(i.valorSolicitado)),
          justificativa: i.justificativa,
        })
        setItens(i.itens.map((x) => ({ chave: proximaChave++, produtoId: x.produtoId, quantidade: String(x.quantidade) })))
        setVersao((v) => v + 1)
      },
      (e) => ativo && setErro(mensagemDeErro(e)),
    )
    return () => {
      ativo = false
    }
  }, [copiar])

  if (opcoes.carregando) return <Carregando />
  const categorias = (opcoes.dados?.categorias ?? []).map(paraCategoria)
  const compraCantina = opcoes.dados?.categorias.find((c) => c.codigo === campos.categoria)?.compraCantina ?? false
  const produtos = opcoes.dados?.produtos ?? []

  function escolherCategoria(codigo: string) {
    alterar({ categoria: codigo })
    const cantina = opcoes.dados?.categorias.find((c) => c.codigo === codigo)?.compraCantina
    if (cantina && itens.length === 0) setItens([{ chave: proximaChave++, produtoId: '', quantidade: '' }])
  }

  function alterarItem(chave: number, parcial: Partial<LinhaItem>) {
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, ...parcial } : i)))
  }

  function escolherArquivos(novos: FileList | null) {
    if (!novos) return
    setArquivos((atuais) => [...atuais, ...Array.from(novos)].slice(0, MAXIMO_ANEXOS + 1))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const centavos = lerValor(campos.valor)
    const locais: Record<string, string> = {}
    if (!campos.descricao.trim()) locais.descricao = 'Descreva o gasto.'
    if (!campos.categoria) locais.categoria = 'Escolha a subcategoria.'
    if (centavos === null || Number.isNaN(centavos) || centavos <= 0) locais.valor = 'Informe um valor maior que zero.'
    if (!campos.justificativa.trim()) locais.justificativa = 'Explique o motivo da despesa.'
    const linhas = compraCantina ? itens.filter((i) => i.produtoId !== '' || i.quantidade.trim()) : []
    if (compraCantina) {
      if (linhas.length === 0) locais.itens = 'Liste os produtos da cantina e as quantidades.'
      for (const i of linhas) {
        const q = Number(i.quantidade)
        if (i.produtoId === '' || !Number.isInteger(q) || q <= 0) locais.itens = 'Escolha o produto e informe uma quantidade inteira positiva em cada linha.'
      }
      const ids = linhas.map((i) => i.produtoId)
      if (new Set(ids).size !== ids.length) locais.itens = 'Cada produto deve aparecer uma única vez.'
    }
    const problemaAnexo = erroAnexos(arquivos)
    if (problemaAnexo) locais.anexos = problemaAnexo
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    try {
      const r = await intencaoService.criar({
        descricao: campos.descricao,
        categoria: campos.categoria,
        valor: paraReais(centavos!),
        justificativa: campos.justificativa,
        itens: linhas.map((i) => ({ produtoId: Number(i.produtoId), quantidade: Number(i.quantidade) })),
        anexos: await Promise.all(arquivos.map(lerAnexo)),
      })
      navegar(`/intencoes-gasto/${r.id}`, { state: { mensagem: `Intenção nº ${r.id} enviada para aprovação.` } })
    } catch (falha) {
      const porCampo = errosPorCampo(falha)
      const doItem = Object.entries(porCampo).find(([c]) => c.startsWith('itens['))
      if (doItem) porCampo.itens = doItem[1]
      setErros(porCampo)
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-nova-intencao">
      <LinkRota to="/intencoes-gasto">Minhas intenções de gasto</LinkRota>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível enviar">
          {erro}
        </Aviso>
      )}
      {opcoes.erro && (
        <Aviso tipo="error" titulo="Erro">
          {opcoes.erro}
        </Aviso>
      )}
      <Card variant="outlined">
        <CardContent>
          <Pilha component="form" onSubmit={enviar} noValidate spacing={2} aria-labelledby="titulo-nova-intencao">
            <TituloPagina id="titulo-nova-intencao">Nova intenção de gasto</TituloPagina>
            {copiar && <TextoSuave>Copiada da intenção nº {copiar}. Revise os dados e anexe os arquivos de novo, se precisar.</TextoSuave>}
            <TextField
              label="Descrição"
              required
              placeholder="Ex.: Compra de produtos para cantina"
              value={campos.descricao}
              onChange={(e) => alterar({ descricao: e.target.value })}
              error={!!erros.descricao}
              helperText={erros.descricao ?? ' '}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <Grade>
              <SeletorCategoria
                key={versao}
                categorias={categorias}
                tipo="DESPESA"
                filtro={() => true}
                valor={campos.categoria}
                onAlterar={escolherCategoria}
                erro={erros.categoria}
              />
              <CampoValor rotulo="Valor estimado" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })} ajuda={erros.valor ?? ' '} />
              <TextField
                label="Justificativa"
                required
                multiline
                minRows={3}
                placeholder="Explique o motivo da despesa…"
                value={campos.justificativa}
                onChange={(e) => alterar({ justificativa: e.target.value })}
                error={!!erros.justificativa}
                helperText={erros.justificativa ?? ' '}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
            </Grade>

            {compraCantina && (
              <Fieldset>
                <FormLabel component="legend">Produtos da cantina</FormLabel>
                <TextoSuave>
                  Só o valor total é aprovado. O Vendedor confere as quantidades quando a compra chegar.
                </TextoSuave>
                {itens.map((i, n) => (
                  <Box key={i.chave} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      select
                      label={`Produto ${n + 1}`}
                      value={i.produtoId}
                      onChange={(e) => alterarItem(i.chave, { produtoId: Number(e.target.value) })}
                      sx={{ flex: 3 }}
                    >
                      {produtos.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.nome}
                          {p.categoria ? ` (${p.categoria})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label={`Quantidade ${n + 1}`}
                      type="number"
                      value={i.quantidade}
                      onChange={(e) => alterarItem(i.chave, { quantidade: e.target.value })}
                      slotProps={{ htmlInput: { min: 1, step: 1, inputMode: 'numeric' } }}
                      sx={{ flex: 1 }}
                    />
                    <Tooltip title="Remover produto">
                      <IconButton aria-label={`Remover produto ${n + 1}`} onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
                <LinhaAcoes>
                  <Button startIcon={<AddIcon />} onClick={() => setItens((l) => [...l, { chave: proximaChave++, produtoId: '', quantidade: '' }])}>
                    Adicionar produto
                  </Button>
                  {erros.itens && (
                    <Typography variant="body2" color="error" role="alert">
                      {erros.itens}
                    </Typography>
                  )}
                </LinhaAcoes>
              </Fieldset>
            )}

            <Fieldset>
              <FormLabel component="legend">Anexar comprovante (opcional)</FormLabel>
              <LinhaAcoes>
                <Button variant="outlined" component="label" disabled={arquivos.length >= MAXIMO_ANEXOS}>
                  Selecionar arquivo
                  <input
                    hidden
                    multiple
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    aria-label="Anexar comprovante (opcional)"
                    onChange={(e) => {
                      escolherArquivos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </Button>
                {arquivos.map((a, n) => (
                  <Chip key={`${a.name}-${n}`} label={a.name} onDelete={() => setArquivos((l) => l.filter((_, i) => i !== n))} />
                ))}
              </LinhaAcoes>
              <TextoSuave role={erros.anexos ? 'alert' : undefined}>
                {erros.anexos ?? 'Orçamento ou comprovante: até 5 arquivos PDF, JPG ou PNG de até 10 MB. Não podem ser trocados depois do envio.'}
              </TextoSuave>
            </Fieldset>

            <LinhaAcoes sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => navegar('/intencoes-gasto')}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" disabled={enviando}>
                Enviar para aprovação
              </Button>
            </LinhaAcoes>
          </Pilha>
        </CardContent>
      </Card>
    </Pilha>
  )
}
