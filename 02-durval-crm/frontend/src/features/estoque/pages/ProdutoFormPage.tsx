import { Autocomplete, Button, InputAdornment, MenuItem, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { validarIsbn } from '../regras'
import { estoqueService } from '../services'
import type { DetalheProduto, OpcoesCatalogo, TipoProduto } from '../types'

interface Campos {
  nome: string
  categoria: string
  autor: string
  isbn: string
  editoraId: number | ''
  repasse: string
  preco: string
}

const VAZIO: Campos = { nome: '', categoria: '', autor: '', isbn: '', editoraId: '', repasse: '', preco: '' }

function deDetalhe(p: DetalheProduto): Campos {
  return {
    nome: p.nome,
    categoria: p.categoria ?? '',
    autor: p.autor ?? '',
    isbn: p.isbn ?? '',
    editoraId: p.editoraId ?? '',
    repasse: p.repassePadrao === null ? '' : String(p.repassePadrao).replace('.', ','),
    preco: paraTextoDigitado(Math.round(p.preco * 100)),
  }
}

/**
 * Cadastro e correção de produto: livro (US-INVENTORY-001, só Administrador) ou cantina
 * (US-INVENTORY-002, com aviso de nome parecido). O preço só é informado no cadastro.
 */
export function ProdutoFormPage() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const detalhe = useCarregamento(() => (id !== undefined ? estoqueService.detalhe(Number(id)) : Promise.resolve(null)), [id])
  const opcoes = useCarregamento(() => estoqueService.opcoes(), [])
  if (detalhe.carregando || opcoes.carregando) return <Carregando />
  if (detalhe.erro || opcoes.erro) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {detalhe.erro ?? opcoes.erro}
      </Aviso>
    )
  }
  const tipo: TipoProduto = detalhe.dados?.tipo ?? (parametros.get('tipo') === 'LIVRO' ? 'LIVRO' : 'CANTINA')
  return <FormularioProduto key={id ?? tipo} tipo={tipo} produto={detalhe.dados} opcoes={opcoes.dados} />
}

function FormularioProduto({
  tipo,
  produto,
  opcoes,
}: {
  tipo: TipoProduto
  produto: DetalheProduto | null
  opcoes: OpcoesCatalogo | null
}) {
  const navegar = useNavigate()
  const { possuiPapel } = useAuth()
  const admin = possuiPapel('administrador')
  const edicao = produto !== null
  const id = produto?.id
  const [campos, setCampos] = useState<Campos>(() => (produto ? deDetalhe(produto) : VAZIO))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const nomeDebounced = useDebounce(campos.nome.trim(), 400)
  const similares = useCarregamento(
    () =>
      tipo === 'CANTINA' && nomeDebounced.length >= 3
        ? estoqueService.similares(nomeDebounced, tipo, id)
        : Promise.resolve([]),
    [nomeDebounced, tipo],
  )

  const alterar = (parcial: Partial<Campos>) => setCampos((c) => ({ ...c, ...parcial }))
  const livro = tipo === 'LIVRO'
  // Os títulos são do Vendedor (com as editoras); na cantina, o Vendedor corrige só sem movimentos.
  const bloqueadoVendedor = edicao && !admin && !livro && produto.possuiHistorico

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    const centavos = lerValor(campos.preco)
    const preco = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)
    if (!edicao && (preco === null || preco <= 0)) locais.preco = 'Informe um preço maior que zero.'
    if (livro && campos.isbn.trim() && !validarIsbn(campos.isbn)) locais.isbn = 'ISBN inválido: confira os 10 ou 13 dígitos.'
    const repasse = campos.repasse.trim() === '' ? null : Number(campos.repasse.replace(',', '.'))
    if (repasse !== null && (Number.isNaN(repasse) || repasse < 0 || repasse > 100)) {
      locais.repassePadrao = 'O repasse deve estar entre 0% e 100%.'
    }
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    setErro(null)
    try {
      const salvo = livro
        ? await (edicao
            ? estoqueService.atualizarLivro(Number(id), {
                titulo: campos.nome,
                autor: campos.autor,
                isbn: campos.isbn,
                editoraId: campos.editoraId === '' ? null : campos.editoraId,
                repassePadrao: repasse,
              })
            : estoqueService.cadastrarLivro({
                titulo: campos.nome,
                autor: campos.autor,
                isbn: campos.isbn,
                editoraId: campos.editoraId === '' ? null : campos.editoraId,
                repassePadrao: repasse,
                preco,
              }))
        : await (edicao
            ? estoqueService.corrigirCantina(Number(id), { nome: campos.nome, categoria: campos.categoria })
            : estoqueService.cadastrarCantina({ nome: campos.nome, categoria: campos.categoria, preco }))
      navegar(`/estoque/produtos/${salvo.id}`)
    } catch (falha) {
      const porCampo = errosPorCampo(falha)
      setErros(livro && porCampo.titulo ? { ...porCampo, nome: porCampo.titulo } : porCampo)
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  const titulo = edicao ? `Editar ${campos.nome || 'produto'}` : livro ? 'Novo título' : 'Novo produto da cantina'
  return (
    <Pilha component="section" aria-labelledby="titulo-form-produto">
      <LinkRota to={edicao ? `/estoque/produtos/${id}` : livro ? '/estoque?aba=livros' : '/estoque'}>Voltar</LinkRota>
      <TituloPagina id="titulo-form-produto">{titulo}</TituloPagina>
      {bloqueadoVendedor && (
        <Aviso tipo="info" titulo="Correção só pelo Administrador">
          Este produto já tem movimentos: só o Administrador pode corrigir o nome e a categoria.
        </Aviso>
      )}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      <Pilha component="form" onSubmit={salvar} noValidate spacing={2} aria-label={titulo}>
        <GradeForm>
          <TextField
            label={livro ? 'Título' : 'Nome'}
            required
            value={campos.nome}
            onChange={(e) => alterar({ nome: e.target.value })}
            error={!!erros.nome}
            helperText={erros.nome}
            disabled={bloqueadoVendedor}
          />
          {livro ? (
            <>
              <TextField label="Autor" value={campos.autor} onChange={(e) => alterar({ autor: e.target.value })} />
              <TextField
                label="ISBN (opcional)"
                value={campos.isbn}
                onChange={(e) => alterar({ isbn: e.target.value })}
                error={!!erros.isbn}
                helperText={erros.isbn ?? 'ISBN-10 ou ISBN-13'}
              />
              <TextField
                select
                label="Editora"
                value={campos.editoraId}
                onChange={(e) => alterar({ editoraId: e.target.value === '' ? '' : Number(e.target.value) })}
                error={!!erros.editoraId}
                helperText={erros.editoraId ?? 'Obrigatória para títulos consignados'}
              >
                <MenuItem value="">Nenhuma</MenuItem>
                {(opcoes?.editoras ?? []).map((ed) => (
                  <MenuItem key={ed.id} value={ed.id}>
                    {ed.nome}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Repasse padrão (consignados)"
                value={campos.repasse}
                onChange={(e) => alterar({ repasse: e.target.value.replace(/[^\d,]/g, '') })}
                error={!!erros.repassePadrao}
                helperText={erros.repassePadrao ?? 'Copiado para cada nova remessa; mudar não afeta remessas existentes.'}
                slotProps={{
                  input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                  htmlInput: { inputMode: 'decimal' },
                }}
              />
            </>
          ) : (
            <Autocomplete
              freeSolo
              options={opcoes?.categorias ?? []}
              inputValue={campos.categoria}
              onInputChange={(_, v) => alterar({ categoria: v })}
              disabled={bloqueadoVendedor}
              renderInput={(params) => (
                <TextField {...params} label="Categoria" required error={!!erros.categoria} helperText={erros.categoria ?? 'Ex.: Bebidas, Salgados, Doces'} />
              )}
            />
          )}
          {!edicao && (
            <CampoValor
              rotulo="Preço de venda"
              valor={campos.preco}
              onAlterar={(v) => alterar({ preco: v })}
              ajuda={erros.preco ?? (livro ? ' ' : 'Depois do cadastro, o preço muda por solicitação aprovada.')}
            />
          )}
        </GradeForm>
        {(similares.dados ?? []).length > 0 && (
          <Aviso tipo="warning" titulo="Já existe produto com nome parecido">
            Confira antes de cadastrar: {(similares.dados ?? []).map((s) => `${s.nome}${s.categoria ? ` (${s.categoria})` : ''}${s.ativo ? '' : ' — inativo'}`).join('; ')}.
          </Aviso>
        )}
        {!edicao && !livro && (
          <TextoSuave>O produto começa com estoque zero; as unidades entram por recebimento de compra ou doação.</TextoSuave>
        )}
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={enviando || bloqueadoVendedor}>
            {edicao ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
          <Button onClick={() => navegar(-1)}>Cancelar</Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
