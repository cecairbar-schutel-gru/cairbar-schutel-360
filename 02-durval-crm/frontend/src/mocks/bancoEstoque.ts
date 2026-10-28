import type { Usuario } from '../auth'
import { compactarIsbn, validarIsbn } from '../features/estoque/regras'
import type {
  AlteracaoPreco,
  DadosCantina,
  DadosLivro,
  DetalheProduto,
  EntradaRegistrada,
  FiltroEstoque,
  FiltroMovimentos,
  FiltroSolicitacoes,
  FotoEnviada,
  ItemEstoque,
  LinhaMovimento,
  LoteDetalhado,
  MotivoBaixa,
  NovaBaixa,
  NovaEntradaDoacao,
  OpcoesCatalogo,
  ProdutoCadastrado,
  ProdutoSimilar,
  ResultadoAjuste,
  ResumoEntradaDoacao,
  ResumoSolicitacao,
  SolicitacaoRegistrada,
  StatusSolicitacao,
  TipoMovimento,
  TipoProduto,
  TipoSolicitacao,
} from '../features/estoque/types'
import { MAXIMO_FOTO_BYTES, MAXIMO_JUSTIFICATIVA, MAXIMO_OBSERVACAO } from '../features/estoque/types'
import type { ErroCampo } from '../shared/api/http'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { normalizarTexto, similaridade } from '../shared/text/texto'
import { EDITORAS, OBRIGACOES, REMESSAS, registrarObrigacao, reiniciarCadastroEditoras, type RemessaMock } from './cadastroEditoras'
import { ErroNegocio } from './erroNegocio'

export interface ProdutoMock {
  id: number
  tipo: TipoProduto
  nome: string
  categoria: string | null
  autor: string | null
  isbn: string | null
  editoraId: number | null
  preco: number
  repassePadrao: number | null
  ativo: boolean
}

interface LoteMock {
  produtoId: number
  remessaId: number | null
  quantidade: number
}

export interface MovimentoMock {
  id: number
  produtoId: number
  remessaId: number | null
  tipo: TipoMovimento
  quantidade: number
  ocorridoEm: string
  usuarioId: string
  usuarioNome: string | null
  referenciaTipo: string | null
  referenciaId: number | null
  estornaMovimentoId: number | null
}

interface SolicitacaoMock {
  id: number
  tipo: TipoSolicitacao
  produtoId: number
  remessaId: number | null
  quantidade: number | null
  motivoBaixa: MotivoBaixa | null
  novoPreco: number | null
  justificativa: string
  foto: FotoEnviada | null
  status: StatusSolicitacao
  solicitanteId: string
  solicitanteNome: string
  solicitadaEm: string
  decididaPorId: string | null
  decididaPorNome: string | null
  decididaEm: string | null
  motivoDecisao: string | null
}

interface DoacaoMock {
  id: number
  observacao: string | null
  registradaEm: string
  registradaPorNome: string
  canceladaEm: string | null
  canceladaPorNome: string | null
  motivoCancelamento: string | null
}

const PRODUTOS: ProdutoMock[] = [
  { id: 1, tipo: 'LIVRO', nome: 'O Caminho', categoria: null, autor: 'André Luiz', isbn: '9788573287868', editoraId: 1, preco: 50, repassePadrao: 35, ativo: true },
  { id: 2, tipo: 'LIVRO', nome: 'Nosso Lar', categoria: null, autor: 'André Luiz', isbn: '9788573286557', editoraId: 2, preco: 45, repassePadrao: null, ativo: true },
  { id: 3, tipo: 'LIVRO', nome: 'O Livro dos Espíritos', categoria: null, autor: 'Allan Kardec', isbn: null, editoraId: 2, preco: 38, repassePadrao: null, ativo: true },
  { id: 10, tipo: 'CANTINA', nome: 'Café', categoria: 'Bebidas', autor: null, isbn: null, editoraId: null, preco: 3.5, repassePadrao: null, ativo: true },
  { id: 11, tipo: 'CANTINA', nome: 'Suco de laranja', categoria: 'Bebidas', autor: null, isbn: null, editoraId: null, preco: 6, repassePadrao: null, ativo: true },
  { id: 12, tipo: 'CANTINA', nome: 'Pão de queijo', categoria: 'Salgados', autor: null, isbn: null, editoraId: null, preco: 5, repassePadrao: null, ativo: true },
  { id: 13, tipo: 'CANTINA', nome: 'Coxinha', categoria: 'Salgados', autor: null, isbn: null, editoraId: null, preco: 7, repassePadrao: null, ativo: true },
  { id: 14, tipo: 'CANTINA', nome: 'Bolo de cenoura', categoria: 'Doces', autor: null, isbn: null, editoraId: null, preco: 4.5, repassePadrao: null, ativo: true },
  { id: 15, tipo: 'CANTINA', nome: 'Brigadeiro', categoria: 'Doces', autor: null, isbn: null, editoraId: null, preco: 3, repassePadrao: null, ativo: false },
]

const LOTES: LoteMock[] = [
  { produtoId: 1, remessaId: 1, quantidade: 3 },
  { produtoId: 1, remessaId: 2, quantidade: 5 },
  { produtoId: 2, remessaId: null, quantidade: 4 },
  { produtoId: 10, remessaId: null, quantidade: 30 },
  { produtoId: 11, remessaId: null, quantidade: 12 },
  { produtoId: 12, remessaId: null, quantidade: 20 },
  { produtoId: 14, remessaId: null, quantidade: 8 },
  { produtoId: 15, remessaId: null, quantidade: 5 },
]

/** Entradas que deram origem aos saldos iniciais (a carga de lotes acima). */
const MOVIMENTOS: Omit<MovimentoMock, 'id'>[] = [
  { produtoId: 1, remessaId: 1, tipo: 'ENTRADA_REMESSA', quantidade: 3, ocorridoEm: '2026-09-01T13:00:00.000Z', usuarioId: 'u-admin', usuarioNome: 'Daniel Administrador', referenciaTipo: 'REMESSA', referenciaId: 1, estornaMovimentoId: null },
  { produtoId: 1, remessaId: 2, tipo: 'ENTRADA_REMESSA', quantidade: 5, ocorridoEm: '2026-10-10T13:00:00.000Z', usuarioId: 'u-admin', usuarioNome: 'Daniel Administrador', referenciaTipo: 'REMESSA', referenciaId: 2, estornaMovimentoId: null },
  { produtoId: 2, remessaId: null, tipo: 'ENTRADA_DOACAO', quantidade: 4, ocorridoEm: '2026-09-28T14:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'ENTRADA_DOACAO', referenciaId: null, estornaMovimentoId: null },
  { produtoId: 10, remessaId: null, tipo: 'ENTRADA_COMPRA', quantidade: 30, ocorridoEm: '2026-10-01T12:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'INTENCAO_GASTO', referenciaId: 1, estornaMovimentoId: null },
  { produtoId: 11, remessaId: null, tipo: 'ENTRADA_COMPRA', quantidade: 12, ocorridoEm: '2026-10-01T12:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'INTENCAO_GASTO', referenciaId: 1, estornaMovimentoId: null },
  { produtoId: 12, remessaId: null, tipo: 'ENTRADA_COMPRA', quantidade: 20, ocorridoEm: '2026-09-30T12:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'INTENCAO_GASTO', referenciaId: 2, estornaMovimentoId: null },
  { produtoId: 14, remessaId: null, tipo: 'ENTRADA_COMPRA', quantidade: 8, ocorridoEm: '2026-09-30T12:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'INTENCAO_GASTO', referenciaId: 2, estornaMovimentoId: null },
  { produtoId: 15, remessaId: null, tipo: 'ENTRADA_COMPRA', quantidade: 5, ocorridoEm: '2026-09-15T12:00:00.000Z', usuarioId: 'u-vendedor', usuarioNome: 'Bruno Vendedor', referenciaTipo: 'INTENCAO_GASTO', referenciaId: 3, estornaMovimentoId: null },
]

const CATEGORIAS_PADRAO = ['Bebidas', 'Salgados', 'Doces']
const ENTRADAS: TipoMovimento[] = ['ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_REMESSA']

const validacao = (campo: string, mensagem: string) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const validacoes = (erros: ErroCampo[]) => {
  if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
}
const regra = (codigo: string, mensagem: string, erros: ErroCampo[] = []) => new ErroNegocio(409, codigo, mensagem, erros)
const centavos = (v: number) => Math.round(v * 100)
const compactar = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ')
const ehAdmin = (u: Usuario) => u.papeis.includes('administrador')

function validarPreco(campo: string, preco: number | null | undefined): number {
  if (preco === null || preco === undefined || !Number.isFinite(preco) || preco <= 0) {
    throw validacao(campo, 'Informe um preço maior que zero.')
  }
  if (Math.abs(preco * 100 - Math.round(preco * 100)) > 1e-6) throw validacao(campo, 'Use no máximo duas casas decimais.')
  return Math.round(preco * 100) / 100
}

function exigirTexto(campo: string, valor: string | null | undefined, mensagem: string, maximo = MAXIMO_JUSTIFICATIVA): string {
  const texto = (valor ?? '').trim()
  if (!texto) throw validacao(campo, mensagem)
  if (texto.length > maximo) throw validacao(campo, `Use até ${maximo} caracteres.`)
  return texto
}

/** Espelho simulado do módulo Estoque do backend (mesmas regras e mensagens); base também das Vendas. */
class BancoEstoque {
  private produtos: ProdutoMock[] = []
  private lotes: LoteMock[] = []
  private historico: MovimentoMock[] = []
  private solicitacoesMock: SolicitacaoMock[] = []
  private doacoes: DoacaoMock[] = []
  private precos: AlteracaoPreco[] = []
  private proximo = { produto: 100, movimento: 1, solicitacao: 1, doacao: 1 }

  constructor() {
    this.reiniciar()
  }

  reiniciar(): void {
    this.produtos = structuredClone(PRODUTOS)
    this.lotes = structuredClone(LOTES)
    this.historico = MOVIMENTOS.map((m, i) => ({ ...m, id: i + 1 }))
    this.solicitacoesMock = []
    this.doacoes = []
    this.precos = []
    this.proximo = { produto: 100, movimento: MOVIMENTOS.length + 1, solicitacao: 1, doacao: 1 }
    reiniciarCadastroEditoras()
  }

  // Apoio às Vendas e aos testes.
  produto(id: number): ProdutoMock {
    const p = this.produtos.find((x) => x.id === id)
    if (!p) throw new ErroNegocio(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado.')
    return p
  }

  existe(id: number): boolean {
    return this.produtos.some((p) => p.id === id)
  }

  todos(): ProdutoMock[] {
    return this.produtos
  }

  saldo(produtoId: number): number {
    return this.lotes.filter((l) => l.produtoId === produtoId).reduce((s, l) => s + l.quantidade, 0)
  }

  /** Lotes e movimentos de todos os produtos, para o relatório de estoque (US-REPORT-007). */
  todosOsLotes(): readonly LoteMock[] {
    return this.lotes
  }

  todosOsMovimentos(): readonly MovimentoMock[] {
    return this.historico
  }

  saldoLote(produtoId: number, remessaId: number | null): number {
    return this.lotes.find((l) => l.produtoId === produtoId && l.remessaId === remessaId)?.quantidade ?? 0
  }

  alterarPreco(produtoId: number, preco: number): void {
    this.produto(produtoId).preco = preco
  }

  definirSaldo(produtoId: number, remessaId: number | null, quantidade: number): void {
    this.lote(produtoId, remessaId).quantidade = quantidade
  }

  /** Obrigações por baixa de consignado (dano ou extravio). */
  listarObrigacoes() {
    return OBRIGACOES.filter((o) => o.origem === 'BAIXA').map((o) => ({
      id: o.id,
      solicitacaoId: o.origemId,
      remessaId: o.remessaId,
      produtoId: o.produtoId,
      valor: o.valor,
    }))
  }

  // Apoio ao módulo Editoras (remessas e devoluções)

  livrosDaEditora(editoraId: number): ProdutoMock[] {
    return this.produtos.filter((p) => p.tipo === 'LIVRO' && p.editoraId === editoraId)
  }

  entrarRemessa(produtoId: number, remessaId: number, quantidade: number, usuario: Usuario): void {
    this.lote(produtoId, remessaId).quantidade += quantidade
    this.registrar(produtoId, remessaId, 'ENTRADA_REMESSA', quantidade, usuario, 'REMESSA', remessaId)
  }

  devolverRemessa(produtoId: number, remessaId: number, quantidade: number, devolucaoId: number, usuario: Usuario): void {
    this.lote(produtoId, remessaId).quantidade -= quantidade
    this.registrar(produtoId, remessaId, 'DEVOLUCAO_EDITORA', -quantidade, usuario, 'DEVOLUCAO_EDITORA', devolucaoId)
  }

  movimentosDeRemessas(): MovimentoMock[] {
    return this.historico.filter((m) => m.remessaId !== null)
  }

  /** Estorna a entrada da remessa cancelada (só sem outros movimentos). */
  cancelarEntradaRemessa(remessaId: number, usuario: Usuario): void {
    for (const m of this.historico.filter((x) => x.remessaId === remessaId && x.tipo === 'ENTRADA_REMESSA')) {
      this.lote(m.produtoId, remessaId).quantidade -= m.quantidade
      this.registrar(m.produtoId, remessaId, 'ESTORNO', -m.quantidade, usuario, 'REMESSA', remessaId, m.id)
    }
  }

  /** Ordem de saída: estoque próprio, depois remessas da mais antiga para a mais nova (FIFO). */
  lotesEmOrdem(produtoId: number): LoteMock[] {
    const chave = (l: LoteMock) => {
      const r = REMESSAS.find((x) => x.id === l.remessaId)
      return `${r?.recebidaEm ?? ''} ${r?.codigo ?? ''}`
    }
    return this.lotes
      .filter((l) => l.produtoId === produtoId)
      .sort((a, b) => (a.remessaId === null ? -1 : b.remessaId === null ? 1 : chave(a).localeCompare(chave(b))))
  }

  /** Tira as unidades na ordem de saída e registra um movimento "Venda" por lote. */
  retirarParaVenda(produtoId: number, quantidade: number, vendaId: number, usuario: Usuario) {
    const retiradas: { remessa: RemessaMock | null; quantidade: number }[] = []
    let falta = quantidade
    for (const lote of this.lotesEmOrdem(produtoId)) {
      if (falta === 0) break
      const tirar = Math.min(falta, lote.quantidade)
      if (tirar === 0) continue
      lote.quantidade -= tirar
      falta -= tirar
      this.registrar(produtoId, lote.remessaId, 'VENDA', -tirar, usuario, 'VENDA', vendaId)
      retiradas.push({ remessa: REMESSAS.find((r) => r.id === lote.remessaId) ?? null, quantidade: tirar })
    }
    return retiradas
  }

  devolverDeVenda(produtoId: number, remessaId: number | null, quantidade: number, vendaId: number, usuario: Usuario): void {
    this.lote(produtoId, remessaId).quantidade += quantidade
    this.registrar(produtoId, remessaId, 'CANCELAMENTO_VENDA', quantidade, usuario, 'VENDA', vendaId)
  }

  private lote(produtoId: number, remessaId: number | null): LoteMock {
    let lote = this.lotes.find((l) => l.produtoId === produtoId && l.remessaId === remessaId)
    if (!lote) {
      lote = { produtoId, remessaId, quantidade: 0 }
      this.lotes.push(lote)
    }
    return lote
  }

  private registrar(
    produtoId: number,
    remessaId: number | null,
    tipo: TipoMovimento,
    quantidade: number,
    usuario: Usuario,
    referenciaTipo: string | null,
    referenciaId: number | null,
    estornaMovimentoId: number | null = null,
  ): MovimentoMock {
    const m: MovimentoMock = {
      id: this.proximo.movimento++,
      produtoId,
      remessaId,
      tipo,
      quantidade,
      ocorridoEm: hoje().toISOString(),
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      referenciaTipo,
      referenciaId,
      estornaMovimentoId,
    }
    this.historico.push(m)
    return m
  }

  private aguardando(produtoId: number, remessaId?: number | null): number {
    return this.solicitacoesMock
      .filter((s) => s.tipo === 'BAIXA' && s.status === 'PENDENTE' && s.produtoId === produtoId)
      .filter((s) => remessaId === undefined || s.remessaId === remessaId)
      .reduce((t, s) => t + (s.quantidade ?? 0), 0)
  }

  private possuiHistorico(produtoId: number): boolean {
    return (
      this.historico.some((m) => m.produtoId === produtoId) ||
      REMESSAS.some((r) => r.repasse[produtoId] !== undefined) ||
      this.solicitacoesMock.some((s) => s.produtoId === produtoId) ||
      this.saldo(produtoId) > 0
    )
  }

  private ultimaEntrada(produtoId: number): string | null {
    const estornados = new Set(this.historico.map((m) => m.estornaMovimentoId))
    const datas = this.historico
      .filter((m) => m.produtoId === produtoId && ENTRADAS.includes(m.tipo) && !estornados.has(m.id))
      .map((m) => m.ocorridoEm)
      .sort()
    return datas.at(-1) ?? null
  }

  private ultimaVenda(produtoId: number): string | null {
    return this.historico.filter((m) => m.produtoId === produtoId && m.tipo === 'VENDA').map((m) => m.ocorridoEm).sort().at(-1) ?? null
  }

  private cadastrado(p: ProdutoMock): ProdutoCadastrado {
    const { id, tipo, nome, categoria, autor, isbn, editoraId, preco, repassePadrao, ativo } = p
    return { id, tipo, nome, categoria, autor, isbn, editoraId, preco, repassePadrao, ativo }
  }

  // US-INVENTORY-009
  listar(filtro: FiltroEstoque): ItemEstoque[] {
    const termo = normalizarTexto(filtro.q ?? '')
    const compacto = compactarIsbn(filtro.q ?? '')
    const isbn = /^(\d{9}[\dX]|\d{13})$/.test(compacto) ? compacto : null
    const situacao = filtro.situacao ?? 'ATIVOS'
    return this.produtos
      .filter((p) => !filtro.tipo || p.tipo === filtro.tipo)
      .filter((p) => !filtro.categoria || (p.categoria ?? '').toLowerCase() === filtro.categoria.toLowerCase())
      .filter((p) => situacao === 'TODOS' || p.ativo === (situacao === 'ATIVOS'))
      .filter((p) => normalizarTexto(`${p.nome} ${p.autor ?? ''}`).includes(termo) || (isbn !== null && p.isbn === isbn))
      .filter((p) => !filtro.somenteSemSaldo || this.saldo(p.id) === 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id)
      .map((p) => {
        const lotes = this.lotes.filter((l) => l.produtoId === p.id)
        const proprio = lotes.filter((l) => l.remessaId === null).reduce((s, l) => s + l.quantidade, 0)
        const saldo = this.saldo(p.id)
        return {
          id: p.id,
          tipo: p.tipo,
          nome: p.nome,
          categoria: p.categoria,
          autor: p.autor,
          isbn: p.isbn,
          editoraNome: EDITORAS.find((e) => e.id === p.editoraId)?.nome ?? null,
          preco: p.preco,
          ativo: p.ativo,
          saldo,
          saldoProprio: proprio,
          saldoConsignado: saldo - proprio,
          aguardandoBaixa: this.aguardando(p.id),
          ultimaEntrada: this.ultimaEntrada(p.id),
        }
      })
  }

  opcoes(): OpcoesCatalogo {
    const usadas = this.produtos.filter((p) => p.tipo === 'CANTINA' && p.categoria).map((p) => p.categoria as string)
    const categorias = [...new Map([...CATEGORIAS_PADRAO, ...usadas].map((c) => [c.toLowerCase(), c])).values()]
    return { editoras: EDITORAS.filter((e) => e.ativa).map(({ id, nome }) => ({ id, nome })), categorias: categorias.sort((a, b) => a.localeCompare(b, 'pt-BR')) }
  }

  similares(nome: string, tipo: TipoProduto | null, excetoId: number | null): ProdutoSimilar[] {
    const n = normalizarTexto(nome)
    if (n.length < 3) return []
    return this.produtos
      .filter((p) => (!tipo || p.tipo === tipo) && p.id !== excetoId)
      .map((p) => ({ p, s: similaridade(p.nome, n), contem: normalizarTexto(p.nome).includes(n) || n.includes(normalizarTexto(p.nome)) }))
      .filter((x) => x.contem || x.s > 0.4)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ p }) => ({ id: p.id, nome: p.nome, categoria: p.categoria, ativo: p.ativo }))
  }

  private lotesDetalhados(produtoId: number): LoteDetalhado[] {
    return this.lotesEmOrdem(produtoId).map((l) => {
      const remessa = REMESSAS.find((r) => r.id === l.remessaId)
      return {
        remessaId: l.remessaId,
        remessaCodigo: remessa?.codigo ?? null,
        recebidaEm: remessa?.recebidaEm ?? null,
        quantidade: l.quantidade,
        aguardandoBaixa: this.aguardando(produtoId, l.remessaId),
        repassePercentual: remessa?.repasse[produtoId] ?? null,
      }
    })
  }

  detalhe(id: number): DetalheProduto {
    const p = this.produto(id)
    const pendente = (tipo: TipoSolicitacao) =>
      this.solicitacoesMock.some((s) => s.produtoId === id && s.tipo === tipo && s.status === 'PENDENTE')
    return {
      ...this.cadastrado(p),
      editoraNome: EDITORAS.find((e) => e.id === p.editoraId)?.nome ?? null,
      saldo: this.saldo(id),
      aguardandoBaixa: this.aguardando(id),
      lotes: this.lotesDetalhados(id),
      historicoPrecos: structuredClone(this.precos.filter((a) => a.produtoId === id).reverse()),
      ultimaVenda: this.ultimaVenda(id),
      possuiHistorico: this.possuiHistorico(id),
      precoPendente: pendente('PRECO'),
      inativacaoPendente: pendente('INATIVACAO'),
    }
  }

  // US-INVENTORY-010: o saldo após cada movimento é calculado a partir do saldo atual.
  movimentos(id: number, filtro: FiltroMovimentos): LinhaMovimento[] {
    this.produto(id)
    if (filtro.de && filtro.ate && filtro.de > filtro.ate) throw validacao('de', 'A data inicial deve ser anterior à final.')
    const todos = this.historico.filter((m) => m.produtoId === id).sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm) || a.id - b.id)
    const estornados = new Set(todos.map((m) => m.estornaMovimentoId))
    let saldo = this.saldo(id)
    const linhas: LinhaMovimento[] = []
    for (const m of [...todos].reverse()) {
      const dia = paraIsoData(new Date(m.ocorridoEm))
      if ((!filtro.de || dia >= filtro.de) && (!filtro.ate || dia <= filtro.ate) && (!filtro.tipo || m.tipo === filtro.tipo)) {
        linhas.push({
          id: m.id,
          ocorridoEm: m.ocorridoEm,
          tipo: m.tipo,
          quantidade: m.quantidade,
          remessaId: m.remessaId,
          remessaCodigo: REMESSAS.find((r) => r.id === m.remessaId)?.codigo ?? null,
          usuarioNome: m.usuarioNome,
          referenciaTipo: m.referenciaTipo,
          referenciaId: m.referenciaId,
          estornaMovimentoId: m.estornaMovimentoId,
          estornado: estornados.has(m.id),
          saldoApos: saldo,
        })
      }
      saldo -= m.quantidade
    }
    return linhas
  }

  // US-INVENTORY-001
  private dadosLivro(dados: DadosLivro, excetoId: number | null) {
    const erros: ErroCampo[] = []
    const titulo = compactar(dados.titulo)
    if (!titulo) erros.push({ campo: 'titulo', mensagem: 'Informe o título.' })
    else if (titulo.length > 200) erros.push({ campo: 'titulo', mensagem: 'Use até 200 caracteres.' })
    const repasse = dados.repassePadrao
    if (repasse !== null && repasse !== undefined && (repasse < 0 || repasse > 100)) {
      erros.push({ campo: 'repassePadrao', mensagem: 'O repasse deve estar entre 0% e 100%, com até duas casas.' })
    }
    if (repasse !== null && repasse !== undefined && !dados.editoraId) {
      erros.push({ campo: 'editoraId', mensagem: 'Informe a editora do título consignado.' })
    }
    const isbn = compactarIsbn(dados.isbn ?? '')
    if (isbn && !validarIsbn(isbn)) erros.push({ campo: 'isbn', mensagem: 'ISBN inválido: confira os 10 ou 13 dígitos.' })
    validacoes(erros)
    if (dados.editoraId && !EDITORAS.some((e) => e.id === dados.editoraId)) throw validacao('editoraId', 'Editora não encontrada.')
    if (isbn && this.produtos.some((p) => p.isbn === isbn && p.id !== excetoId)) {
      throw validacao('isbn', 'Este ISBN já está cadastrado em outro título.')
    }
    return { nome: titulo, autor: compactar(dados.autor) || null, isbn: isbn || null, editoraId: dados.editoraId ?? null, repassePadrao: repasse ?? null }
  }

  cadastrarLivro(dados: DadosLivro): ProdutoCadastrado {
    const preco = validarPreco('preco', dados.preco)
    const p: ProdutoMock = { id: this.proximo.produto++, tipo: 'LIVRO', categoria: null, preco, ativo: true, ...this.dadosLivro(dados, null) }
    this.produtos.push(p)
    return this.cadastrado(p)
  }

  atualizarLivro(id: number, dados: DadosLivro): ProdutoCadastrado {
    const p = this.produto(id)
    if (p.tipo !== 'LIVRO') throw regra('TIPO_PRODUTO_INCORRETO', 'Este produto não é um livro.')
    Object.assign(p, this.dadosLivro(dados, id))
    return this.cadastrado(p)
  }

  // US-INVENTORY-013
  alterarPrecoLivro(id: number, preco: number, motivo: string, usuario: Usuario): ProdutoCadastrado {
    const p = this.produto(id)
    if (p.tipo !== 'LIVRO') throw regra('PRECO_POR_SOLICITACAO', 'O preço da cantina muda por solicitação aprovada pelo Administrador.')
    this.mudarPreco(p, preco, motivo, null, usuario.nome)
    return this.cadastrado(p)
  }

  private mudarPreco(p: ProdutoMock, novo: number, motivo: string, solicitadoPor: string | null, aprovadoPor: string): void {
    const valor = validarPreco('preco', novo)
    const texto = exigirTexto('motivo', motivo, 'Informe o motivo da alteração.')
    if (centavos(valor) === centavos(p.preco)) throw validacao('preco', 'O novo preço é igual ao atual.')
    this.precos.push({ produtoId: p.id, precoAnterior: p.preco, precoNovo: valor, alteradoEm: hoje().toISOString(), solicitadoPor, aprovadoPor, motivo: texto })
    p.preco = valor
  }

  // US-INVENTORY-002
  private dadosCantina(dados: DadosCantina) {
    const erros: ErroCampo[] = []
    const nome = compactar(dados.nome)
    const categoria = compactar(dados.categoria)
    if (!nome) erros.push({ campo: 'nome', mensagem: 'Informe o nome.' })
    else if (nome.length > 200) erros.push({ campo: 'nome', mensagem: 'Use até 200 caracteres.' })
    if (!categoria) erros.push({ campo: 'categoria', mensagem: 'Informe a categoria.' })
    else if (categoria.length > 60) erros.push({ campo: 'categoria', mensagem: 'Use até 60 caracteres.' })
    validacoes(erros)
    return { nome, categoria }
  }

  cadastrarCantina(dados: DadosCantina): ProdutoCadastrado {
    const preco = validarPreco('preco', dados.preco)
    const p: ProdutoMock = { id: this.proximo.produto++, tipo: 'CANTINA', ...this.dadosCantina(dados), autor: null, isbn: null, editoraId: null, preco, repassePadrao: null, ativo: true }
    this.produtos.push(p)
    return this.cadastrado(p)
  }

  corrigirCantina(id: number, dados: DadosCantina, usuario: Usuario): ProdutoCadastrado {
    const p = this.produto(id)
    if (p.tipo !== 'CANTINA') throw regra('TIPO_PRODUTO_INCORRETO', 'Este produto não é da cantina.')
    if (!ehAdmin(usuario) && this.possuiHistorico(id)) {
      throw regra('PRODUTO_COM_MOVIMENTOS', 'Este produto já tem movimentos: só o Administrador pode corrigir o nome e a categoria.')
    }
    Object.assign(p, this.dadosCantina(dados))
    return this.cadastrado(p)
  }

  private exigirSemSaldo(saldo: number): void {
    if (saldo > 0) {
      throw regra('PRODUTO_COM_SALDO', `Dê baixa ou venda as ${saldo} ${saldo === 1 ? 'unidade restante' : 'unidades restantes'} antes de inativar.`)
    }
  }

  inativar(id: number, motivo: string): ProdutoCadastrado {
    const p = this.produto(id)
    exigirTexto('motivo', motivo, 'Informe o motivo da inativação.')
    if (p.tipo === 'CANTINA') this.exigirSemSaldo(this.saldo(id))
    if (!p.ativo) throw regra('PRODUTO_JA_INATIVO', 'O produto já está inativo.')
    p.ativo = false
    return this.cadastrado(p)
  }

  reativar(id: number): ProdutoCadastrado {
    const p = this.produto(id)
    if (p.ativo) throw regra('PRODUTO_JA_ATIVO', 'O produto já está ativo.')
    p.ativo = true
    return this.cadastrado(p)
  }

  excluir(id: number): void {
    this.produto(id)
    if (this.possuiHistorico(id)) throw regra('PRODUTO_COM_MOVIMENTOS', 'Este produto já tem movimentos e não pode ser excluído. Inative-o.')
    this.produtos = this.produtos.filter((p) => p.id !== id)
    this.lotes = this.lotes.filter((l) => l.produtoId !== id)
  }

  // US-INVENTORY-016
  ajustar(id: number, dados: { remessaId: number | null; quantidadeContada: number; motivo: string }, usuario: Usuario): ResultadoAjuste {
    this.produto(id)
    const contada = dados.quantidadeContada
    if (!Number.isInteger(contada) || contada < 0) throw validacao('quantidadeContada', 'Informe a quantidade contada (zero ou mais).')
    const motivo = exigirTexto('motivo', dados.motivo, 'Informe o motivo do ajuste.')
    const existente = this.lotes.find((l) => l.produtoId === id && l.remessaId === dados.remessaId)
    if (dados.remessaId !== null && !existente) throw validacao('remessaId', 'Esta remessa não tem lote deste produto.')
    const saldo = existente?.quantidade ?? 0
    const diferenca = contada - saldo
    if (diferenca === 0) throw validacao('quantidadeContada', 'A contagem é igual ao saldo do sistema.')
    if (dados.remessaId !== null && diferenca < 0) {
      const s = this.novaSolicitacao({ tipo: 'BAIXA', produtoId: id, remessaId: dados.remessaId, quantidade: -diferenca, motivoBaixa: 'EXTRAVIO', justificativa: `Ajuste após contagem: ${motivo}` }, usuario)
      s.status = 'APROVADA'
      s.decididaPorId = usuario.id
      s.decididaPorNome = usuario.nome
      s.decididaEm = s.solicitadaEm
      this.aplicarBaixa(s, usuario)
      return { saldoAnterior: saldo, quantidadeContada: contada, diferenca, tipo: 'BAIXA_EXTRAVIO', solicitacaoId: s.id }
    }
    this.lote(id, dados.remessaId).quantidade += diferenca
    this.registrar(id, dados.remessaId, 'AJUSTE', diferenca, usuario, 'AJUSTE', null)
    return { saldoAnterior: saldo, quantidadeContada: contada, diferenca, tipo: 'AJUSTE', solicitacaoId: null }
  }

  /** Recebimento conferido de compra da cantina (US-EXPENSE-006): entra como estoque próprio. */
  registrarCompra(intencaoId: number, itens: { produtoId: number; quantidade: number }[], usuario: Usuario): void {
    validacoes(
      itens.flatMap((i) => {
        const p = this.produtos.find((x) => x.id === i.produtoId)
        if (!p) return [{ campo: `itens[${i.produtoId}]`, mensagem: 'Produto não encontrado.' }]
        return p.ativo ? [] : [{ campo: `itens[${i.produtoId}]`, mensagem: `${p.nome} está inativo.` }]
      }),
    )
    for (const i of itens) {
      this.lote(i.produtoId, null).quantidade += i.quantidade
      this.registrar(i.produtoId, null, 'ENTRADA_COMPRA', i.quantidade, usuario, 'INTENCAO_GASTO', intencaoId)
    }
  }

  // US-INVENTORY-006
  entradasDoacao(): ResumoEntradaDoacao[] {
    return [...this.doacoes]
      .sort((a, b) => b.registradaEm.localeCompare(a.registradaEm) || b.id - a.id)
      .slice(0, 50)
      .map((d) => {
        const itens = this.historico
          .filter((m) => m.referenciaTipo === 'ENTRADA_DOACAO' && m.referenciaId === d.id && m.tipo === 'ENTRADA_DOACAO')
          .map((m) => ({ produtoId: m.produtoId, produtoNome: this.produto(m.produtoId).nome, quantidade: m.quantidade }))
        return {
          ...structuredClone(d),
          itens,
          cancelavel: d.canceladaEm === null && itens.every((i) => this.saldoLote(i.produtoId, null) >= i.quantidade),
        }
      })
  }

  registrarDoacao(dados: NovaEntradaDoacao, usuario: Usuario): EntradaRegistrada {
    const erros: ErroCampo[] = []
    if (dados.itens.length === 0) erros.push({ campo: 'itens', mensagem: 'Adicione ao menos um produto.' })
    for (const i of dados.itens) {
      if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) erros.push({ campo: `itens[${i.produtoId}]`, mensagem: 'Informe uma quantidade inteira positiva.' })
    }
    if (new Set(dados.itens.map((i) => i.produtoId)).size !== dados.itens.length) erros.push({ campo: 'itens', mensagem: 'Cada produto deve aparecer uma única vez.' })
    const observacao = compactar(dados.observacao)
    if (observacao.length > MAXIMO_OBSERVACAO) erros.push({ campo: 'observacao', mensagem: `Use até ${MAXIMO_OBSERVACAO} caracteres.` })
    validacoes(erros)
    validacoes(
      dados.itens.flatMap((i) => {
        const p = this.produtos.find((x) => x.id === i.produtoId)
        if (!p) return [{ campo: `itens[${i.produtoId}]`, mensagem: 'Produto não encontrado.' }]
        return p.ativo ? [] : [{ campo: `itens[${i.produtoId}]`, mensagem: `${p.nome} está inativo.` }]
      }),
    )
    const d: DoacaoMock = { id: this.proximo.doacao++, observacao: observacao || null, registradaEm: hoje().toISOString(), registradaPorNome: usuario.nome, canceladaEm: null, canceladaPorNome: null, motivoCancelamento: null }
    this.doacoes.push(d)
    for (const i of dados.itens) {
      this.lote(i.produtoId, null).quantidade += i.quantidade
      this.registrar(i.produtoId, null, 'ENTRADA_DOACAO', i.quantidade, usuario, 'ENTRADA_DOACAO', d.id)
    }
    return { id: d.id, registradaEm: d.registradaEm, cancelada: false }
  }

  cancelarDoacao(id: number, motivo: string, usuario: Usuario): EntradaRegistrada {
    const d = this.doacoes.find((x) => x.id === id)
    if (!d) throw new ErroNegocio(404, 'ENTRADA_NAO_ENCONTRADA', 'Entrada por doação não encontrada.')
    if (d.canceladaEm) throw regra('ENTRADA_JA_CANCELADA', 'Esta entrada já foi cancelada.')
    const texto = exigirTexto('motivo', motivo, 'Informe o motivo do cancelamento.')
    const movimentos = this.historico.filter((m) => m.referenciaTipo === 'ENTRADA_DOACAO' && m.referenciaId === id && m.tipo === 'ENTRADA_DOACAO')
    const faltas = movimentos.flatMap((m) => {
      const proprio = this.saldoLote(m.produtoId, null)
      return proprio >= m.quantidade
        ? []
        : [{ campo: `itens[${m.produtoId}]`, mensagem: `Restam só ${proprio} de ${m.quantidade} unidades de ${this.produto(m.produtoId).nome} no estoque próprio.` }]
    })
    if (faltas.length > 0) throw regra('UNIDADES_JA_SAIRAM', 'Parte das unidades doadas já saiu do estoque. A entrada não pode ser cancelada.', faltas)
    for (const m of movimentos) {
      this.lote(m.produtoId, null).quantidade -= m.quantidade
      this.registrar(m.produtoId, null, 'ESTORNO', -m.quantidade, usuario, 'ENTRADA_DOACAO', id, m.id)
    }
    d.canceladaEm = hoje().toISOString()
    d.canceladaPorNome = usuario.nome
    d.motivoCancelamento = texto
    return { id, registradaEm: d.registradaEm, cancelada: true }
  }

  // US-INVENTORY-007/011/014
  private novaSolicitacao(
    dados: Pick<SolicitacaoMock, 'tipo' | 'produtoId' | 'justificativa'> & Partial<SolicitacaoMock>,
    usuario: Usuario,
  ): SolicitacaoMock {
    const s: SolicitacaoMock = {
      remessaId: null,
      quantidade: null,
      motivoBaixa: null,
      novoPreco: null,
      foto: null,
      ...dados,
      id: this.proximo.solicitacao++,
      status: 'PENDENTE',
      solicitanteId: usuario.id,
      solicitanteNome: usuario.nome,
      solicitadaEm: hoje().toISOString(),
      decididaPorId: null,
      decididaPorNome: null,
      decididaEm: null,
      motivoDecisao: null,
    }
    this.solicitacoesMock.push(s)
    return s
  }

  private registrada(s: SolicitacaoMock): SolicitacaoRegistrada {
    return { id: s.id, tipo: s.tipo, status: s.status, autoAprovada: s.status === 'APROVADA' && s.solicitanteId === s.decididaPorId }
  }

  solicitarBaixa(dados: NovaBaixa, usuario: Usuario): SolicitacaoRegistrada {
    const p = this.produto(dados.produtoId)
    const erros: ErroCampo[] = []
    if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0) erros.push({ campo: 'quantidade', mensagem: 'Informe uma quantidade inteira positiva.' })
    if (!dados.motivo) erros.push({ campo: 'motivo', mensagem: 'Escolha o motivo: vencimento, dano ou extravio.' })
    const justificativa = (dados.justificativa ?? '').trim()
    if (!justificativa) erros.push({ campo: 'justificativa', mensagem: 'Informe a justificativa.' })
    else if (justificativa.length > MAXIMO_JUSTIFICATIVA) erros.push({ campo: 'justificativa', mensagem: `Use até ${MAXIMO_JUSTIFICATIVA} caracteres.` })
    validacoes(erros)
    if (dados.foto) {
      if (!['image/jpeg', 'image/png'].includes(dados.foto.tipo)) throw validacao('foto', 'A foto deve ser JPG ou PNG.')
      if (Math.floor((dados.foto.conteudoBase64.length * 3) / 4) > MAXIMO_FOTO_BYTES) throw validacao('foto', 'A foto deve ter até 5 MB.')
    }
    const lote = this.lotes.find((l) => l.produtoId === p.id && l.remessaId === dados.remessaId)
    if (!lote) {
      throw validacao('remessaId', dados.remessaId === null ? 'Este produto não tem estoque próprio.' : 'Esta remessa não tem unidades deste produto.')
    }
    const disponivel = lote.quantidade - this.aguardando(p.id, dados.remessaId)
    if (dados.quantidade > disponivel) {
      throw validacao('quantidade', disponivel <= 0 ? 'Não há unidades disponíveis para baixa neste lote.' : `A quantidade passa do saldo disponível para baixa (${disponivel}).`)
    }
    return this.registrada(this.novaSolicitacao({ tipo: 'BAIXA', produtoId: p.id, remessaId: dados.remessaId, quantidade: dados.quantidade, motivoBaixa: dados.motivo, justificativa, foto: dados.foto }, usuario))
  }

  private cantinaAtiva(produtoId: number): ProdutoMock {
    const p = this.produto(produtoId)
    if (p.tipo !== 'CANTINA') throw regra('SOMENTE_CANTINA', 'Este pedido é só para produtos da cantina; livros são alterados pelo Administrador.')
    if (!p.ativo) throw regra('PRODUTO_INATIVO', 'O produto está inativo.')
    return p
  }

  private exigirSemPendente(produtoId: number, tipo: TipoSolicitacao, mensagem: string): void {
    if (this.solicitacoesMock.some((s) => s.produtoId === produtoId && s.tipo === tipo && s.status === 'PENDENTE')) {
      throw regra('SOLICITACAO_PENDENTE_EXISTENTE', mensagem)
    }
  }

  solicitarPreco(produtoId: number, novoPreco: number, motivo: string, usuario: Usuario): SolicitacaoRegistrada {
    const p = this.cantinaAtiva(produtoId)
    this.exigirSemPendente(produtoId, 'PRECO', 'Já existe um pedido de preço pendente para este produto.')
    const valor = validarPreco('novoPreco', novoPreco)
    if (centavos(valor) === centavos(p.preco)) throw validacao('novoPreco', 'O novo preço é igual ao atual.')
    const texto = exigirTexto('motivo', motivo, 'Informe o motivo.')
    return this.registrada(this.novaSolicitacao({ tipo: 'PRECO', produtoId, novoPreco: valor, justificativa: texto }, usuario))
  }

  solicitarInativacao(produtoId: number, motivo: string, usuario: Usuario): SolicitacaoRegistrada {
    this.cantinaAtiva(produtoId)
    this.exigirSemPendente(produtoId, 'INATIVACAO', 'Já existe um pedido de inativação pendente para este produto.')
    const texto = exigirTexto('motivo', motivo, 'Informe o motivo.')
    return this.registrada(this.novaSolicitacao({ tipo: 'INATIVACAO', produtoId, justificativa: texto }, usuario))
  }

  private carregar(id: number): SolicitacaoMock {
    const s = this.solicitacoesMock.find((x) => x.id === id)
    if (!s) throw new ErroNegocio(404, 'SOLICITACAO_NAO_ENCONTRADA', 'Solicitação não encontrada.')
    return s
  }

  private exigirPendente(s: SolicitacaoMock): void {
    if (s.status !== 'PENDENTE') {
      const como = { APROVADA: 'aprovada.', REJEITADA: 'rejeitada.', CANCELADA: 'cancelada.', PENDENTE: '' }[s.status]
      throw regra('SOLICITACAO_NAO_PENDENTE', `Esta solicitação já foi ${como}`)
    }
  }

  private resumo(s: SolicitacaoMock): ResumoSolicitacao {
    const p = this.produto(s.produtoId)
    return {
      id: s.id,
      tipo: s.tipo,
      produtoId: p.id,
      produtoNome: p.nome,
      produtoTipo: p.tipo,
      remessaId: s.remessaId,
      remessaCodigo: REMESSAS.find((r) => r.id === s.remessaId)?.codigo ?? null,
      quantidade: s.quantidade,
      motivoBaixa: s.motivoBaixa,
      justificativa: s.justificativa,
      precoVigente: p.preco,
      novoPreco: s.novoPreco,
      diferencaPercentual: s.novoPreco === null ? null : Math.round(((s.novoPreco - p.preco) / p.preco) * 1000) / 10,
      temFoto: s.foto !== null,
      status: s.status,
      solicitanteNome: s.solicitanteNome,
      solicitadaEm: s.solicitadaEm,
      decididaPorNome: s.decididaPorNome,
      decididaEm: s.decididaEm,
      motivoDecisao: s.motivoDecisao,
      autoAprovada: s.status === 'APROVADA' && s.solicitanteId === s.decididaPorId,
      saldoAtual: s.tipo === 'BAIXA' ? this.saldoLote(p.id, s.remessaId) : this.saldo(p.id),
      ultimaVenda: this.ultimaVenda(p.id),
    }
  }

  /** Item "Solicitações de estoque" do checklist do fechamento (US-CLOSING-001). */
  pendentesFeitasAntesDe(limite: string): number {
    return this.solicitacoesMock.filter((s) => s.status === 'PENDENTE' && s.solicitadaEm < limite).length
  }

  solicitacoes(filtro: FiltroSolicitacoes, usuario: Usuario): ResumoSolicitacao[] {
    const todas = !filtro.minhas && ehAdmin(usuario)
    const pendentes = filtro.status === 'PENDENTE'
    return this.solicitacoesMock
      .filter((s) => todas || s.solicitanteId === usuario.id)
      .filter((s) => !filtro.status || s.status === filtro.status)
      .sort((a, b) => (pendentes ? 1 : -1) * (a.solicitadaEm.localeCompare(b.solicitadaEm) || a.id - b.id))
      .map((s) => this.resumo(s))
  }

  foto(id: number, usuario: Usuario): FotoEnviada {
    const s = this.carregar(id)
    if (!ehAdmin(usuario) && s.solicitanteId !== usuario.id) throw new ErroNegocio(404, 'SOLICITACAO_NAO_ENCONTRADA', 'Solicitação não encontrada.')
    if (!s.foto) throw new ErroNegocio(404, 'FOTO_NAO_ENCONTRADA', 'Esta solicitação não tem foto.')
    return s.foto
  }

  cancelarSolicitacao(id: number, usuario: Usuario): SolicitacaoRegistrada {
    const s = this.carregar(id)
    this.exigirPendente(s)
    if (s.solicitanteId !== usuario.id) throw regra('SOLICITACAO_DE_OUTRO_USUARIO', 'Só quem fez a solicitação pode cancelá-la.')
    s.status = 'CANCELADA'
    s.decididaPorId = usuario.id
    s.decididaPorNome = usuario.nome
    s.decididaEm = hoje().toISOString()
    return this.registrada(s)
  }

  /** Bloqueia se o saldo do lote não cobre; consignado por dano ou extravio gera obrigação sem receita. */
  private aplicarBaixa(s: SolicitacaoMock, usuario: Usuario): void {
    const p = this.produto(s.produtoId)
    const saldo = this.saldoLote(p.id, s.remessaId)
    const quantidade = s.quantidade ?? 0
    if (saldo < quantidade) {
      throw regra('SALDO_INSUFICIENTE', `O saldo atual do lote é ${saldo} e não cobre a baixa de ${quantidade}. Rejeite ou peça uma nova solicitação.`)
    }
    this.lote(p.id, s.remessaId).quantidade -= quantidade
    const tipo = `BAIXA_${s.motivoBaixa}` as TipoMovimento
    this.registrar(p.id, s.remessaId, tipo, -quantidade, usuario, 'SOLICITACAO_ESTOQUE', s.id)
    const remessa = REMESSAS.find((r) => r.id === s.remessaId)
    if (remessa && s.motivoBaixa !== 'VENCIMENTO') {
      registrarObrigacao({ remessa, produtoId: p.id, origem: 'BAIXA', origemId: s.id, origemNumero: s.id, quantidade, precoUnitario: p.preco })
    }
  }

  aprovar(id: number, usuario: Usuario): SolicitacaoRegistrada {
    const s = this.carregar(id)
    this.exigirPendente(s)
    const p = this.produto(s.produtoId)
    if (s.tipo === 'BAIXA') this.aplicarBaixa(s, usuario)
    if (s.tipo === 'PRECO') this.mudarPreco(p, s.novoPreco ?? 0, s.justificativa, s.solicitanteNome, usuario.nome)
    if (s.tipo === 'INATIVACAO') {
      this.exigirSemSaldo(this.saldo(p.id))
      p.ativo = false
    }
    s.status = 'APROVADA'
    s.decididaPorId = usuario.id
    s.decididaPorNome = usuario.nome
    s.decididaEm = hoje().toISOString()
    return this.registrada(s)
  }

  rejeitar(id: number, motivo: string, usuario: Usuario): SolicitacaoRegistrada {
    const s = this.carregar(id)
    this.exigirPendente(s)
    s.motivoDecisao = exigirTexto('motivo', motivo, 'Informe o motivo da rejeição.')
    s.status = 'REJEITADA'
    s.decididaPorId = usuario.id
    s.decididaPorNome = usuario.nome
    s.decididaEm = hoje().toISOString()
    return this.registrada(s)
  }
}

export const bancoEstoque = new BancoEstoque()

