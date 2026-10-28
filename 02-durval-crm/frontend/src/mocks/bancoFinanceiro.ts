import type { Usuario } from '../auth'
import type {
  Anexo,
  Cancelamento,
  Categoria,
  ContaFinanceira,
  Correcao,
  DadosConta,
  DetalheLancamento,
  ContasRecebimento,
  FiltroLancamentos,
  ItemLancamento,
  NaturezaLancamento,
  NovaLiquidacao,
  NovaTransferencia,
  NovoLancamentoManual,
  OrigemLancamento,
  PaginaLancamentos,
  PainelTesoureiro,
  QuadroSaldos,
  SaldoCartaoAReceber,
  ResultadoEstorno,
  ResultadoLancamento,
  SaldoConta,
  TipoCategoria,
  TipoConta,
} from '../features/financeiro/types'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import type { Conta, TipoCartao } from '../shared/pagamento/regras'
import { ErroNegocio } from './erroNegocio'
import { travaPeriodo } from './travaPeriodo'

export interface ContaMock extends Conta {
  codigo: string
  tipo: TipoConta
  ativa: boolean
  localizacao: string | null
  banco: string | null
  agencia: string | null
  numeroConta: string | null
  saldoInicial: number
  dataCorte: string
}

const CORTE_INICIAL = '2026-01-01'
const conta = (id: number, codigo: string, nome: string, tipo: TipoConta, extra: Partial<ContaMock> = {}): ContaMock => ({
  id,
  codigo,
  nome,
  tipo,
  ativa: true,
  localizacao: null,
  banco: null,
  agencia: null,
  numeroConta: null,
  saldoInicial: 0,
  dataCorte: CORTE_INICIAL,
  ...extra,
})

const contasIniciais = (): ContaMock[] => [
  conta(1, 'cx-1', 'Caixa Secretaria', 'CAIXA', { localizacao: 'Secretaria' }),
  conta(2, 'cx-2', 'Caixa Cantina', 'CAIXA', { localizacao: 'Cantina' }),
  conta(3, 'banco-a', 'Banco A', 'BANCO', { banco: 'Banco A', agencia: '0001', numeroConta: '12345-6' }),
  conta(4, 'banco-b', 'Banco B', 'BANCO', { banco: 'Banco B', agencia: '0002', numeroConta: '65432-1' }),
  conta(5, 'cartao-a-receber', 'Cartão a receber', 'CARTAO_A_RECEBER'),
]

export const CONTAS: ContaMock[] = contasIniciais()
/** Conta única; o objeto é preservado entre reinícios porque outros mocks guardam a referência. */
export const CARTAO = CONTAS[4]

export const ORGANIZACAO = {
  nome: 'Centro Espírita Cairbar Schutel',
  cnpj: '',
  endereco: '',
  rodape: 'Obrigado pela sua contribuição!',
}

export type CategoriaPlanoMock = Omit<Categoria, 'nomeCompleto' | 'permiteManual'> & { sistema: boolean }

/** Subcategorias dos fluxos automáticos: renomeáveis, nunca inativadas (US-ADMIN-004). */
export const CATEGORIAS_SISTEMA = new Set<string>([
  'RECEITAS_CONTRIBUICOES.MENSALIDADES',
  'RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS',
  'RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS',
  'RECEITAS_VENDAS.LIVROS',
  'RECEITAS_VENDAS.CANTINA',
  'DESPESAS_COMERCIAIS.COMPRA_CANTINA',
  'DESPESAS_COMERCIAIS.REPASSE_EDITORAS',
  'DESPESAS_COMERCIAIS.TAXAS_CARTAO',
])

/** Plano de contas inicial (Spec §5), igual ao das migrações V2, V8 e V10 do backend. */
const planoInicial = (): CategoriaPlanoMock[] => [
  ['RECEITAS_CONTRIBUICOES', 'Receitas de contribuições', 'RECEITA', null],
  ['RECEITAS_CONTRIBUICOES.MENSALIDADES', 'Mensalidades', 'RECEITA', 'RECEITAS_CONTRIBUICOES'],
  ['RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS', 'Doações extraordinárias', 'RECEITA', 'RECEITAS_CONTRIBUICOES'],
  ['RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS', 'Doações anônimas', 'RECEITA', 'RECEITAS_CONTRIBUICOES'],
  ['RECEITAS_VENDAS', 'Receitas de vendas', 'RECEITA', null],
  ['RECEITAS_VENDAS.LIVROS', 'Livros', 'RECEITA', 'RECEITAS_VENDAS'],
  ['RECEITAS_VENDAS.CANTINA', 'Cantina', 'RECEITA', 'RECEITAS_VENDAS'],
  ['OUTRAS_RECEITAS', 'Outras receitas', 'RECEITA', null],
  ['OUTRAS_RECEITAS.OUTRAS_ENTRADAS', 'Outras entradas', 'RECEITA', 'OUTRAS_RECEITAS'],
  ['DESPESAS_OPERACIONAIS', 'Despesas operacionais', 'DESPESA', null],
  ['DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA', 'Energia elétrica', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.AGUA', 'Água', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.INTERNET', 'Internet', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.MANUTENCAO_CONSERVACAO', 'Manutenção e conservação', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA', 'Material de limpeza', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.MATERIAIS_CONSUMO', 'Materiais de consumo', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.ALUGUEL', 'Aluguel', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_OPERACIONAIS.SEGURO', 'Seguro', 'DESPESA', 'DESPESAS_OPERACIONAIS'],
  ['DESPESAS_COMERCIAIS', 'Despesas comerciais', 'DESPESA', null],
  ['DESPESAS_COMERCIAIS.COMPRA_CANTINA', 'Compra de produtos da cantina', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  ['DESPESAS_COMERCIAIS.REPASSE_EDITORAS', 'Repasse às editoras', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  ['DESPESAS_COMERCIAIS.TAXAS_CARTAO', 'Taxas de cartão', 'DESPESA', 'DESPESAS_COMERCIAIS'],
  ['OUTRAS_DESPESAS', 'Outras despesas', 'DESPESA', null],
  ['OUTRAS_DESPESAS.EVENTOS', 'Despesas com eventos', 'DESPESA', 'OUTRAS_DESPESAS'],
  ['OUTRAS_DESPESAS.TAXAS_BANCARIAS', 'Taxas bancárias', 'DESPESA', 'OUTRAS_DESPESAS'],
  ['OUTRAS_DESPESAS.OUTRAS_SAIDAS', 'Outras saídas', 'DESPESA', 'OUTRAS_DESPESAS'],
].map(([codigo, nome, tipo, categoriaPai]) => ({
  codigo: codigo as string,
  nome: nome as string,
  tipo: tipo as TipoCategoria,
  categoriaPai: categoriaPai as string | null,
  ativa: true,
  sistema: CATEGORIAS_SISTEMA.has(codigo as string),
}))

/** Mantido pela Administração (US-ADMIN-004); o objeto é preservado entre reinícios. */
export const CATEGORIAS: CategoriaPlanoMock[] = planoInicial()

export const CATEGORIA = {
  MENSALIDADES: 'RECEITAS_CONTRIBUICOES.MENSALIDADES',
  DOACOES_EXTRAORDINARIAS: 'RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS',
  DOACOES_ANONIMAS: 'RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS',
  VENDAS_LIVROS: 'RECEITAS_VENDAS.LIVROS',
  VENDAS_CANTINA: 'RECEITAS_VENDAS.CANTINA',
  TAXAS_CARTAO: 'DESPESAS_COMERCIAIS.TAXAS_CARTAO',
  REPASSE_EDITORAS: 'DESPESAS_COMERCIAIS.REPASSE_EDITORAS',
} as const

/** Categorias com fluxo próprio, fora do lançamento manual (US-FINANCIAL-009). */
const FLUXO_PROPRIO = new Set<string>([
  CATEGORIA.MENSALIDADES,
  CATEGORIA.DOACOES_EXTRAORDINARIAS,
  CATEGORIA.DOACOES_ANONIMAS,
  CATEGORIA.VENDAS_LIVROS,
  CATEGORIA.VENDAS_CANTINA,
  CATEGORIA.TAXAS_CARTAO,
  'DESPESAS_COMERCIAIS.COMPRA_CANTINA',
  'DESPESAS_COMERCIAIS.REPASSE_EDITORAS',
])
const ESTORNAVEIS = new Set<OrigemLancamento>(['MANUAL', 'TRANSFERENCIA', 'LIQUIDACAO_CARTAO', 'INTENCAO_GASTO', 'PAGAMENTO_EDITORA', 'CONTA_PAGAR'])

/** Valores em centavos inteiros. */
interface LinhaConta {
  contaId: number
  valor: number
  /** Só em Cartão a receber: crédito ou débito da venda, contribuição ou liquidação. */
  tipoCartao?: TipoCartao | null
}
interface LinhaCategoria {
  categoria: string
  valor: number
}

interface LancamentoMock {
  id: number
  data: string
  origemTipo: OrigemLancamento
  origemId: number | null
  descricao: string
  usuario: string
  criadoEm: string
  estorna: number | null
  corrige: number | null
  motivo: string | null
  referencia: string | null
  chave: string | null
  contas: LinhaConta[]
  categorias: LinhaCategoria[]
  anexo: Anexo | null
  historico: DetalheLancamento['historico']
}

/** Lançamento visto por uma conta: movimento líquido nela (US-RECONCILIATION). */
export interface LancamentoNaConta {
  id: number
  data: string
  descricao: string
  origemTipo: OrigemLancamento
  origemId: number | null
  natureza: NaturezaLancamento
  valor: number
  estornaLancamentoId: number | null
  estornadoPorId: number | null
  corrigeLancamentoId: number | null
  podeCorrigir: boolean
}

export interface NovoLancamentoMock {
  data: string
  origemTipo: OrigemLancamento
  origemId: number | null
  descricao: string
  /** Em reais; convertidos para centavos. */
  contas: { contaId: number; valor: number; tipoCartao?: TipoCartao | null }[]
  categorias: { categoria: string; valor: number }[]
}

const centavos = (v: number) => Math.round(v * 100)
const reais = (c: number) => c / 100
const brl = (c: number) => formatarMoeda(reais(c)).replace(/ /g, ' ')
const dataBr = (iso: string) => iso.split('-').reverse().join('/')
const soma = (valores: number[]) => valores.reduce((s, v) => s + v, 0)
const validacao = (campo: string, mensagem: string) =>
  new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const regra = (codigo: string, mensagem: string) => new ErroNegocio(409, codigo, mensagem)
const duasCasas = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6
const POR_PAGINA = 50

/** Espelho simulado do módulo Financeiro: contas, contas de recebimento, lançamentos e estornos. */
class BancoFinanceiro {
  /** Módulos que reagem ao estorno de um lançamento seu (ex.: pagamento a editora); sobrevivem ao reinício. */
  private readonly aoEstornarOrigem = new Map<OrigemLancamento, (origemId: number) => void>()
  private registros: LancamentoMock[] = []
  /** Contas de recebimento definidas pelo Administrador (ids); `null`: forma sem conta. */
  private recebimento: { dinheiro: number | null; pix: number | null } = { dinheiro: 1, pix: 3 }
  /** `lancamento_linha_conta.conciliacao_id`: "lançamento:conta" → sessão que conciliou. */
  private conciliadas = new Map<string, number>()
  private proximoId = 1

  reiniciar(): void {
    CATEGORIAS.length = 0
    CATEGORIAS.push(...planoInicial())
    const iniciais = contasIniciais()
    CONTAS.length = 0
    CONTAS.push(...iniciais.slice(0, 4))
    Object.assign(CARTAO, iniciais[4])
    CONTAS.push(CARTAO)
    this.registros = []
    this.recebimento = { dinheiro: 1, pix: 3 }
    this.conciliadas = new Map()
    this.proximoId = 1
  }

  // Usado pelas contribuições e vendas

  contasRecebimento(): ContasRecebimento {
    const destino = (id: number | null) => {
      const c = id === null ? undefined : CONTAS.find((x) => x.id === id)
      return c ? this.paraConta(c, false) : null
    }
    return { dinheiro: destino(this.recebimento.dinheiro), pix: destino(this.recebimento.pix), cartao: this.paraConta(CARTAO, false) }
  }

  definirContasRecebimento(dinheiro: number | null, pix: number | null): ContasRecebimento {
    const erros: { campo: string; mensagem: string }[] = []
    const valida = (id: number | null, tipo: TipoConta) => id === null || CONTAS.some((c) => c.id === id && c.tipo === tipo && c.ativa)
    if (!valida(dinheiro, 'CAIXA')) erros.push({ campo: 'dinheiroContaId', mensagem: 'O dinheiro deve entrar num caixa ativo.' })
    if (!valida(pix, 'BANCO')) erros.push({ campo: 'pixContaId', mensagem: 'O PIX deve entrar numa conta bancária ativa.' })
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
    this.recebimento = { dinheiro, pix }
    return this.contasRecebimento()
  }

  /** Conta do dinheiro ou do PIX; sem conta definida ou ativa, nada é registrado. */
  contaDeRecebimento(meio: 'DINHEIRO' | 'PIX' | 'CARTAO'): ContaMock {
    if (meio === 'CARTAO') return CARTAO
    const id = meio === 'DINHEIRO' ? this.recebimento.dinheiro : this.recebimento.pix
    const c = CONTAS.find((x) => x.id === id && x.ativa)
    if (!c) {
      throw regra('CONTA_RECEBIMENTO_NAO_DEFINIDA', `Nenhuma conta ativa recebe ${meio === 'DINHEIRO' ? 'dinheiro' : 'PIX'}. Peça ao Administrador para definir as contas de recebimento.`)
    }
    return c
  }

  /** Saldo inicial mais os lançamentos, em reais. */
  saldo(contaId: number, ate?: string): number {
    return reais(this.saldoCentavos(contaId, ate))
  }

  /** Lançamento automático de outro módulo (receitas de contribuições e vendas). */
  registrar(novo: NovoLancamentoMock, usuario: Usuario): number {
    return this.gravar(
      {
        data: novo.data,
        origemTipo: novo.origemTipo,
        origemId: novo.origemId,
        descricao: novo.descricao,
        contas: agrupar(novo.contas.map((l) => ({ contaId: l.contaId, valor: centavos(l.valor), tipoCartao: l.tipoCartao ?? null }))),
        categorias: novo.categorias.map((l) => ({ categoria: l.categoria, valor: centavos(l.valor) })).filter((l) => l.valor !== 0),
      },
      usuario,
    ).id
  }

  /** Saldo atual de Cartão a receber por tipo; o que não tem tipo fica em "não informado". */
  cartaoAReceber(): SaldoCartaoAReceber {
    const total = this.saldoCentavos(CARTAO.id)
    const doTipo = (tipo: TipoCartao) =>
      soma(this.registros.filter((l) => l.data >= CARTAO.dataCorte).flatMap((l) => l.contas)
        .filter((c) => c.contaId === CARTAO.id && c.tipoCartao === tipo).map((c) => c.valor))
    const credito = doTipo('CREDITO')
    const debito = doTipo('DEBITO')
    return { total: reais(total), credito: reais(credito), debito: reais(debito), naoInformado: reais(total - credito - debito) }
  }

  /** Estorno pedido pelo cancelamento de contribuição ou venda. */
  estornarOrigem(origemTipo: OrigemLancamento, origemId: number, descricao: string, usuario: Usuario): void {
    const original = this.registros.find((l) => l.origemTipo === origemTipo && l.origemId === origemId && l.estorna === null)
    if (original) this.estornarLancamento(original, descricao, null, usuario)
  }

  /** Despesa de outro módulo (intenção de gasto), com as mesmas regras de saldo; devolve id e avisos. */
  lancarDespesa(novo: NovoLancamentoMock, usuario: Usuario): ResultadoLancamento {
    const { id, avisos } = this.gravar(
      {
        data: novo.data,
        origemTipo: novo.origemTipo,
        origemId: novo.origemId,
        descricao: novo.descricao,
        contas: agrupar(novo.contas.map((l) => ({ contaId: l.contaId, valor: centavos(l.valor) }))),
        categorias: novo.categorias.map((l) => ({ categoria: l.categoria, valor: centavos(l.valor) })),
      },
      usuario,
    )
    return { id, avisos }
  }

  /** Equivale a `EstornoNaOrigemPort` do backend. */
  aoEstornar(origemTipo: OrigemLancamento, reagir: (origemId: number) => void): void {
    this.aoEstornarOrigem.set(origemTipo, reagir)
  }

  estornado(lancamentoId: number): boolean {
    return this.estornoDe(lancamentoId) !== undefined
  }

  estornarPorId(lancamentoId: number, descricao: string, motivo: string, usuario: Usuario): void {
    this.estornarLancamento(this.lancamentoMock(lancamentoId), descricao, motivo, usuario)
  }

  /** Despesas da subcategoria no mês ("AAAA-MM"), já descontados os estornos. */
  despesasNoMes(categoria: string, mes: string): number {
    const total = this.registros
      .filter((l) => l.data.startsWith(mes))
      .flatMap((l) => l.categorias)
      .filter((c) => c.categoria === categoria)
      .reduce((s, c) => s - c.valor, 0)
    return reais(total)
  }

  /** Simula uma liquidação sem taxa (testes das contribuições e vendas). */
  liquidarParaTeste(valor: number): void {
    const banco = CONTAS.find((c) => c.tipo === 'BANCO')!
    this.registros.push(this.novo({
      data: paraIsoData(hoje()),
      origemTipo: 'LIQUIDACAO_CARTAO',
      origemId: null,
      descricao: 'Liquidação de cartão',
      contas: [{ contaId: CARTAO.id, valor: -centavos(valor) }, { contaId: banco.id, valor: centavos(valor) }],
      categorias: [],
    }, 'Teste'))
  }

  // Usado pela conciliação bancária (US-RECONCILIATION)

  /** Lançamentos da conta ainda não conciliados, com o movimento líquido nela, por data e id. */
  naoConciliadosDaConta(contaId: number): LancamentoNaConta[] {
    return [...this.registros]
      .filter((l) => l.contas.some((c) => c.contaId === contaId) && !this.conciliadas.has(`${l.id}:${contaId}`))
      .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
      .map((l) => this.naConta(l, contaId))
  }

  lancamentoNaConta(id: number, contaId: number): LancamentoNaConta {
    return this.naConta(this.lancamentoMock(id), contaId)
  }

  /** Conclusão da sessão: as linhas passam a apontar para ela (definitivo). */
  conciliar(conciliacaoId: number, contaId: number, ids: number[]): void {
    for (const id of ids) this.conciliadas.set(`${id}:${contaId}`, conciliacaoId)
  }

  // Usado pelo fechamento mensal (US-CLOSING-001 e 007)

  /** Mês da data de corte mais antiga entre caixas e contas bancárias. */
  primeiroPeriodo(): string | null {
    const cortes = CONTAS.filter((c) => c.tipo !== 'CARTAO_A_RECEBER').map((c) => c.dataCorte).sort()
    return cortes.length > 0 ? cortes[0].slice(0, 7) : null
  }

  /** Data da última liquidação de cartão até a data (estornos não contam). */
  ultimaLiquidacaoAte(data: string): string | null {
    const datas = this.registros.filter((l) => l.origemTipo === 'LIQUIDACAO_CARTAO' && l.estorna === null && l.data <= data).map((l) => l.data).sort()
    return datas.length > 0 ? datas[datas.length - 1] : null
  }

  /** Receitas e despesas do mês por categoria-mãe e subcategoria (despesas positivas; estornos na data em que caíram). */
  porCategoria(mes: string): Record<TipoCategoria, { codigo: string; nome: string; valor: number; subcategorias: { codigo: string; nome: string; valor: number }[] }[]> {
    const somas = new Map<string, number>()
    for (const l of this.registros.filter((x) => x.data.startsWith(mes))) {
      for (const c of l.categorias) somas.set(c.categoria, (somas.get(c.categoria) ?? 0) + c.valor)
    }
    const resultado: ReturnType<BancoFinanceiro['porCategoria']> = { RECEITA: [], DESPESA: [] }
    for (const tipo of ['RECEITA', 'DESPESA'] as const) {
      const porMae = new Map<string, { codigo: string; nome: string; valor: number }[]>()
      for (const [codigo, valor] of somas) {
        const sub = CATEGORIAS.find((c) => c.codigo === codigo)
        if (!sub || sub.tipo !== tipo || valor === 0) continue
        const mae = sub.categoriaPai ?? sub.codigo
        const lista = porMae.get(mae) ?? []
        lista.push({ codigo, nome: sub.nome, valor: reais(tipo === 'RECEITA' ? valor : -valor) })
        porMae.set(mae, lista)
      }
      for (const [codigo, subs] of porMae) {
        subs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        resultado[tipo].push({
          codigo,
          nome: CATEGORIAS.find((c) => c.codigo === codigo)?.nome ?? codigo,
          valor: reais(soma(subs.map((s) => centavos(s.valor)))),
          subcategorias: subs,
        })
      }
      resultado[tipo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    }
    return resultado
  }

  /** Abertura, entradas, saídas, transferências (inclui liquidações de cartão) e saldo final de cada conta no mês. */
  movimentoPorConta(mes: string, fim: string) {
    const inicio = `${mes}-01`
    return CONTAS.filter((c) => c.dataCorte <= fim)
      .map((c) => {
        let entradas = 0
        let saidas = 0
        let tEntrada = 0
        let tSaida = 0
        for (const l of this.registros.filter((x) => x.data >= inicio && x.data <= fim)) {
          const original = l.estorna !== null ? this.lancamentoMock(l.estorna) : l
          const interna = original.origemTipo === 'TRANSFERENCIA' || original.origemTipo === 'LIQUIDACAO_CARTAO'
          for (const linha of l.contas.filter((x) => x.contaId === c.id)) {
            if (interna && linha.valor > 0) tEntrada += linha.valor
            else if (interna) tSaida -= linha.valor
            else if (linha.valor > 0) entradas += linha.valor
            else saidas -= linha.valor
          }
        }
        const inicial = this.saldoCentavos(c.id, undefined, inicio)
        return {
          contaId: c.id,
          nome: c.nome,
          tipo: c.tipo,
          saldoInicial: reais(inicial),
          entradas: reais(entradas),
          saidas: reais(saidas),
          transferenciasEntrada: reais(tEntrada),
          transferenciasSaida: reais(tSaida),
          saldoFinal: reais(inicial + entradas - saidas + tEntrada - tSaida),
        }
      })
      .sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  // Usado pelos relatórios (US-REPORT-001 a 003)

  /** Linhas de conta e de categoria de cada lançamento do período, em centavos, por data e id. */
  linhasNoPeriodo(de: string, ate: string): { id: number; data: string; contas: Map<number, number>; categorias: Map<string, number> }[] {
    return [...this.registros]
      .filter((l) => l.data >= de && l.data <= ate)
      .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
      .map((l) => {
        const contas = new Map<number, number>()
        for (const c of l.contas) contas.set(c.contaId, (contas.get(c.contaId) ?? 0) + c.valor)
        const categorias = new Map<string, number>()
        for (const c of l.categorias) categorias.set(c.categoria, (categorias.get(c.categoria) ?? 0) + c.valor)
        return { id: l.id, data: l.data, contas, categorias }
      })
  }

  /** Soma das linhas de categoria no período (receitas positivas, despesas negativas), em centavos. */
  somaPorCategoria(de: string, ate: string): Map<string, number> {
    const somas = new Map<string, number>()
    for (const l of this.registros.filter((x) => x.data >= de && x.data <= ate)) {
      for (const c of l.categorias) somas.set(c.categoria, (somas.get(c.categoria) ?? 0) + c.valor)
    }
    return somas
  }

  /** Saldo de cada conta no fim do dia, em centavos. */
  saldosEm(data: string): Map<number, number> {
    return new Map(CONTAS.map((c) => [c.id, this.saldoCentavos(c.id, data)]))
  }

  planoDeContas(): Omit<Categoria, 'nomeCompleto' | 'permiteManual'>[] {
    return CATEGORIAS.map((c) => ({ codigo: c.codigo, nome: c.nome, tipo: c.tipo, categoriaPai: c.categoriaPai, ativa: c.ativa }))
  }

  /** Categorias usadas por lançamentos (US-ADMIN-004: usadas só se inativam). */
  categoriasEmUso(): Set<string> {
    const anteriores = new Set(this.registros.flatMap((l) => l.historico.map((h) => h.de)))
    return new Set([
      ...this.registros.flatMap((l) => l.categorias.map((c) => c.categoria)),
      ...CATEGORIAS.filter((c) => anteriores.has(this.paraCategoria(c.codigo).nomeCompleto)).map((c) => c.codigo),
    ])
  }

  // US-ADMIN-012: histórico importado, anterior à data de corte e já contido no saldo inicial.

  importar(data: string, importacaoId: number, descricao: string, contaId: number, categoria: string, valor: number, usuario: Usuario): number {
    travaPeriodo.exigirAberto(data)
    const c = this.contaMock(contaId)
    if (data >= c.dataCorte) {
      throw regra('DEPOIS_DA_DATA_DE_CORTE', `O histórico de ${c.nome} deve ser anterior à data de corte (${dataBr(c.dataCorte)}).`)
    }
    const lancamento = this.novo(
      {
        data,
        origemTipo: 'IMPORTACAO',
        origemId: importacaoId,
        descricao,
        contas: [{ contaId, valor: centavos(valor) }],
        categorias: [{ categoria, valor: centavos(valor) }],
      },
      usuario.nome,
    )
    this.registros.push(lancamento)
    return lancamento.id
  }

  importacaoIntocada(importacaoId: number): boolean {
    return this.registros
      .filter((l) => l.origemTipo === 'IMPORTACAO' && l.origemId === importacaoId)
      .every((l) => !this.estornado(l.id) && l.historico.length === 0 && !l.anexo && ![...this.conciliadas.keys()].some((k) => k.startsWith(`${l.id}:`)))
  }

  desfazerImportacao(importacaoId: number): void {
    this.registros = this.registros.filter((l) => !(l.origemTipo === 'IMPORTACAO' && l.origemId === importacaoId))
  }

  /** Data do estorno do lançamento de uma contribuição ou venda cancelada (nula se não foi estornado). */
  dataDoEstorno(origemTipo: OrigemLancamento, origemId: number): string | null {
    const original = this.registros.find((l) => l.origemTipo === origemTipo && l.origemId === origemId && l.estorna === null)
    return original ? (this.estornoDe(original.id)?.data ?? null) : null
  }

  // US-FINANCIAL-001

  contas(): ContaFinanceira[] {
    return [...CONTAS]
      .sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo) || a.nome.localeCompare(b.nome))
      .map((c) => this.paraConta(c))
  }

  conta(id: number): ContaFinanceira {
    return this.paraConta(this.contaMock(id))
  }

  cadastrarConta(dados: DadosConta): ContaFinanceira {
    if (dados.tipo === 'CARTAO_A_RECEBER') {
      throw regra('CARTAO_A_RECEBER_UNICO', 'Cartão a receber é uma conta única, criada pelo sistema.')
    }
    this.validarDados(dados.tipo, dados)
    const codigo = this.codigoDoNome(dados.tipo, dados.nome)
    const nova = conta(Math.max(...CONTAS.map((c) => c.id)) + 1, codigo, dados.nome.trim(), dados.tipo, this.camposDe(dados))
    CONTAS.push(nova)
    return this.paraConta(nova)
  }

  alterarConta(id: number, dados: DadosConta): ContaFinanceira {
    const c = this.contaMock(id)
    this.validarDados(c.tipo, dados)
    if (this.temLancamentos(id) && (centavos(dados.saldoInicial) !== centavos(c.saldoInicial) || dados.dataCorte !== c.dataCorte)) {
      throw regra('CONTA_COM_LANCAMENTOS', 'O saldo inicial e a data de corte não podem mudar depois do primeiro lançamento.')
    }
    Object.assign(c, { nome: dados.nome.trim() }, this.camposDe(dados))
    return this.paraConta(c)
  }

  inativarConta(id: number): ContaFinanceira {
    const c = this.contaMock(id)
    if (c.tipo === 'CARTAO_A_RECEBER') throw regra('CARTAO_A_RECEBER_UNICO', 'Cartão a receber não pode ser inativada.')
    if (!c.ativa) throw regra('CONTA_JA_INATIVA', 'A conta já está inativa.')
    this.exigirForaDoRecebimento(c, 'inativá-la')
    const saldo = this.saldoCentavos(id)
    if (saldo !== 0) throw regra('CONTA_COM_SALDO', `Só é possível inativar a conta com saldo zero. Saldo atual: ${brl(saldo)}.`)
    c.ativa = false
    return this.paraConta(c)
  }

  reativarConta(id: number): ContaFinanceira {
    const c = this.contaMock(id)
    if (c.ativa) throw regra('CONTA_JA_ATIVA', 'A conta já está ativa.')
    c.ativa = true
    return this.paraConta(c)
  }

  excluirConta(id: number): void {
    const c = this.contaMock(id)
    if (c.tipo === 'CARTAO_A_RECEBER') throw regra('CARTAO_A_RECEBER_UNICO', 'Cartão a receber não pode ser excluída.')
    this.exigirForaDoRecebimento(c, 'excluí-la')
    if (this.temLancamentos(id)) {
      throw regra('CONTA_COM_LANCAMENTOS', 'Contas com lançamentos não podem ser excluídas. Inative a conta quando o saldo for zero.')
    }
    CONTAS.splice(CONTAS.indexOf(c), 1)
  }

  // US-FINANCIAL-002

  saldos(data?: string): QuadroSaldos {
    const dia = data || paraIsoData(hoje())
    if (data && data > paraIsoData(hoje())) throw validacao('data', 'Escolha hoje ou uma data passada.')
    const visiveis: SaldoConta[] = CONTAS.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nome: c.nome,
        tipo: c.tipo,
        ativa: c.ativa,
        dataCorte: c.dataCorte,
        saldo: data && data < c.dataCorte ? null : this.saldo(c.id, data),
      }))
      .filter((s) => s.ativa || (s.saldo !== null && s.saldo !== 0))
      .sort((a, b) => a.nome.localeCompare(b.nome))
    const doTipo = (tipo: TipoConta) => visiveis.filter((s) => s.tipo === tipo)
    const subtotal = (lista: SaldoConta[]) => reais(soma(lista.map((s) => centavos(s.saldo ?? 0))))
    const cartao = doTipo('CARTAO_A_RECEBER')[0] ?? null
    const caixas = doTipo('CAIXA')
    const bancos = doTipo('BANCO')
    return {
      data: dia,
      caixas,
      bancos,
      cartaoAReceber: cartao,
      subtotalCaixas: subtotal(caixas),
      subtotalBancos: subtotal(bancos),
      total: subtotal([...caixas, ...bancos, ...(cartao ? [cartao] : [])]),
    }
  }

  categorias(): Categoria[] {
    return CATEGORIAS.map((c) => this.paraCategoria(c.codigo))
  }

  // US-FINANCIAL-003, 004 e 009

  transferir(usuario: Usuario, dados: NovaTransferencia): ResultadoLancamento {
    return this.idempotente(dados.chaveIdempotencia, () => this.transferencia(usuario, dados, null))
  }

  liquidarCartao(usuario: Usuario, dados: NovaLiquidacao): ResultadoLancamento {
    return this.idempotente(dados.chaveIdempotencia, () => this.liquidacao(usuario, dados, null))
  }

  lancarManual(usuario: Usuario, dados: NovoLancamentoManual): ResultadoLancamento {
    return this.idempotente(dados.chaveIdempotencia, () => this.manual(usuario, dados, null))
  }

  // US-FINANCIAL-005

  lancamentos(filtro: FiltroLancamentos, pagina: number): PaginaLancamentos {
    if (filtro.de && filtro.ate && filtro.de > filtro.ate) throw validacao('de', 'A data inicial deve ser anterior à final.')
    const contaFiltrada = filtro.contaId ? this.contaMock(filtro.contaId) : null
    // Antes do corte só existe o histórico importado (US-ADMIN-012), que entra quando o período o inclui.
    const de = contaFiltrada && !filtro.de ? contaFiltrada.dataCorte : filtro.de
    const ordenados = [...this.registros].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
    const noPeriodo = ordenados.filter(
      (l) => (!de || l.data >= de) && (!filtro.ate || l.data <= filtro.ate) && (!contaFiltrada || l.contas.some((c) => c.contaId === contaFiltrada.id)),
    )
    const abertura = contaFiltrada ? this.saldoCentavos(contaFiltrada.id, undefined, de) : 0
    let acumulado = abertura
    const saldoApos = new Map<number, number>()
    if (contaFiltrada) {
      for (const l of noPeriodo) {
        acumulado += this.valorNaConta(l, contaFiltrada.id)
        saldoApos.set(l.id, acumulado)
      }
    }
    const texto = filtro.texto?.trim().toLowerCase()
    const valor = filtro.valor === undefined ? undefined : centavos(Math.abs(filtro.valor))
    const filtrados = noPeriodo.filter(
      (l) =>
        (!filtro.natureza || natureza(l) === filtro.natureza) &&
        (!filtro.origem || l.origemTipo === filtro.origem) &&
        (!filtro.categoria || l.categorias.some((c) => c.categoria === filtro.categoria || c.categoria.startsWith(`${filtro.categoria}.`))) &&
        (!texto || l.descricao.toLowerCase().includes(texto)) &&
        (valor === undefined || [...l.contas, ...l.categorias].some((c) => Math.abs(c.valor) === valor)),
    )
    const pagina_ = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
    return {
      conta: contaFiltrada ? this.paraConta(contaFiltrada, false) : null,
      itens: pagina_.map((l): ItemLancamento => ({
        id: l.id,
        data: l.data,
        descricao: l.descricao,
        natureza: natureza(l),
        origemTipo: l.origemTipo,
        origemId: l.origemId,
        categorias: [...new Set(l.categorias.map((c) => this.paraCategoria(c.categoria).nomeCompleto))],
        contas: [...new Set(l.contas.map((c) => this.contaMock(c.contaId).nome))],
        valor: reais(contaFiltrada ? this.valorNaConta(l, contaFiltrada.id) : valorPrincipal(l)),
        usuario: l.usuario,
        estornaLancamentoId: l.estorna,
        estornadoPorId: this.estornoDe(l.id)?.id ?? null,
        corrigeLancamentoId: l.corrige,
        conciliado: contaFiltrada ? this.conciliadas.has(`${l.id}:${contaFiltrada.id}`) : null,
        saldoApos: contaFiltrada ? reais(saldoApos.get(l.id)!) : null,
      })),
      temMais: filtrados.length > (pagina + 1) * POR_PAGINA,
      saldoAnterior: contaFiltrada ? reais(abertura) : null,
      saldoFinal: contaFiltrada ? reais(acumulado) : null,
    }
  }

  lancamento(id: number): DetalheLancamento {
    const l = this.lancamentoMock(id)
    const estorno = this.estornoDe(id)
    const nat = natureza(l)
    return {
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      natureza: nat,
      origemTipo: l.origemTipo,
      origemId: l.origemId,
      valor: reais(valorPrincipal(l)),
      usuario: l.usuario,
      registradoEm: l.criadoEm,
      motivo: l.motivo,
      referenciaExterna: l.referencia,
      estornaLancamentoId: l.estorna,
      estornadoPorId: estorno?.id ?? null,
      corrigeLancamentoId: l.corrige,
      correcoes: this.registros.filter((x) => x.corrige === id).map((x) => x.id),
      linhasConta: l.contas.map((c) => {
        const conta = this.contaMock(c.contaId)
        return { contaId: c.contaId, contaNome: conta.nome, tipoConta: conta.tipo, valor: reais(c.valor) }
      }),
      linhasCategoria: l.categorias.map((c, ordem) => {
        const cat = this.paraCategoria(c.categoria)
        return { ordem, codigo: c.categoria, nome: cat.nomeCompleto, tipo: cat.tipo, valor: reais(c.valor) }
      }),
      historico: l.historico,
      temAnexo: l.anexo !== null,
      conciliado: l.contas.some((c) => this.conciliadas.has(`${l.id}:${c.contaId}`)),
      podeEstornar: ESTORNAVEIS.has(l.origemTipo) && l.estorna === null && !estorno,
      podeReclassificar: (nat === 'RECEITA' || nat === 'DESPESA') && !estorno,
    }
  }

  anexo(id: number): Anexo {
    const a = this.lancamentoMock(id).anexo
    if (!a) throw new ErroNegocio(404, 'ANEXO_NAO_ENCONTRADO', 'Este lançamento não tem anexo.')
    return a
  }

  // US-FINANCIAL-010

  estornar(usuario: Usuario, id: number, motivo: string, correcao: Correcao | null): ResultadoEstorno {
    const original = this.lancamentoMock(id)
    if (!ESTORNAVEIS.has(original.origemTipo)) {
      throw regra(
        'CORRIGIR_PELO_CANCELAMENTO',
        original.origemTipo === 'CONTRIBUICAO'
          ? 'Contribuições são corrigidas pelo cancelamento da contribuição.'
          : original.origemTipo === 'VENDA'
            ? 'Vendas são corrigidas pelo cancelamento da venda.'
            : 'Este lançamento é corrigido no módulo que o gerou.',
      )
    }
    const texto = motivo.trim().replace(/\s+/g, ' ')
    if (texto.length < 10 || texto.length > 500) throw validacao('motivo', 'Explique o motivo do estorno (de 10 a 500 caracteres).')
    const estorno = this.estornarLancamento(original, `Estorno: ${original.descricao}`, texto, usuario)
    if (original.origemId !== null) this.aoEstornarOrigem.get(original.origemTipo)?.(original.origemId)
    let correcaoId: number | null = null
    const avisos = [...estorno.avisos]
    if (correcao) {
      const c = this.corrigir(usuario, original, correcao)
      correcaoId = c.id
      avisos.push(...c.avisos)
    }
    return { estornoId: estorno.id, correcaoId, avisos }
  }

  // US-FINANCIAL-021

  reclassificar(usuario: Usuario, id: number, ordem: number, categoria: string, motivo: string): DetalheLancamento {
    const l = this.lancamentoMock(id)
    const nat = natureza(l)
    if (nat !== 'RECEITA' && nat !== 'DESPESA') {
      throw regra('RECLASSIFICACAO_NAO_PERMITIDA', 'Só lançamentos de receita ou despesa podem ser reclassificados.')
    }
    if (this.estornoDe(id)) throw regra('LANCAMENTO_ESTORNADO', 'Este lançamento foi estornado e não pode mais ser reclassificado.')
    if (travaPeriodo.estaFechado(l.data.slice(0, 7))) {
      throw regra('PERIODO_FECHADO', 'O lançamento é de um mês fechado. Peça ao Administrador a reabertura do período.')
    }
    const linha = l.categorias[ordem]
    if (!linha) throw validacao('ordem', 'Escolha a linha de categoria a reclassificar.')
    const texto = motivo.trim()
    if (!texto || texto.length > 500) throw validacao('motivo', 'Informe o motivo da reclassificação (até 500 caracteres).')
    const atual = this.paraCategoria(linha.categoria)
    const nova = CATEGORIAS.find((c) => c.codigo === categoria)
    if (!nova || !nova.ativa || !nova.categoriaPai || nova.tipo !== atual.tipo) {
      throw validacao('categoria', `Escolha uma subcategoria ativa de ${atual.tipo === 'RECEITA' ? 'receita.' : 'despesa.'}`)
    }
    if (nova.codigo === atual.codigo) throw validacao('categoria', 'Escolha uma subcategoria diferente da atual.')
    l.historico.push({
      ordem,
      de: atual.nomeCompleto,
      para: this.paraCategoria(nova.codigo).nomeCompleto,
      por: usuario.nome,
      em: hoje().toISOString(),
      motivo: texto,
    })
    linha.categoria = nova.codigo
    return this.lancamento(id)
  }

  // US-FINANCIAL-015

  painelTesoureiro(
    mensalidades: PainelTesoureiro['mensalidades'],
    intencoesPendentes: number,
    conciliadasAte: Map<number, string>,
  ): PainelTesoureiro {
    const agora = hoje()
    const mes = paraIsoData(agora).slice(0, 7)
    const doMes = this.registros.filter((l) => l.data.startsWith(mes))
    let receitas = 0
    let despesas = 0
    let taxas = 0
    for (const l of doMes) {
      for (const c of l.categorias) {
        if (this.paraCategoria(c.categoria).tipo === 'RECEITA') receitas += c.valor
        else despesas -= c.valor
        if (c.categoria === CATEGORIA.TAXAS_CARTAO) taxas -= c.valor
      }
    }
    const seteDias = new Date(agora.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    const saldos = this.saldos()
    const cancelamentos: Cancelamento[] = this.registros
      .filter((l) => l.estorna !== null && (l.origemTipo === 'CONTRIBUICAO' || l.origemTipo === 'VENDA') && l.criadoEm >= seteDias)
      .reverse()
      .map((e) => {
        const o = this.lancamentoMock(e.estorna!)
        return {
          lancamentoId: e.id,
          data: e.data,
          registradoEm: e.criadoEm,
          origemTipo: e.origemTipo,
          origemId: e.origemId,
          descricao: o.descricao,
          valor: reais(soma(o.categorias.map((c) => c.valor))),
          registradoPor: e.usuario,
        }
      })
    return {
      mes,
      mensalidades,
      resumoDoMes: { receitas: reais(receitas), despesas: reais(despesas), taxasCartao: reais(taxas) },
      receitaLiquida: reais(receitas - taxas),
      saldos,
      intencoesPendentes,
      conciliacoes: saldos.bancos.map((b) => ({
        contaId: b.id,
        contaNome: b.nome,
        naoConciliados: this.naoConciliadosDaConta(b.id).length,
        ultimaConciliacao: conciliadasAte.get(b.id) ?? null,
      })),
      periodo: { mes, situacao: 'EM_ANDAMENTO', itensConcluidos: null, itensTotal: null },
      cancelamentosRecentes: cancelamentos,
    }
  }

  // Regras comuns de todo lançamento

  private gravar(
    dados: Omit<LancamentoMock, 'id' | 'usuario' | 'criadoEm' | 'estorna' | 'corrige' | 'motivo' | 'referencia' | 'chave' | 'anexo' | 'historico'> &
      Partial<Pick<LancamentoMock, 'estorna' | 'corrige' | 'motivo' | 'referencia' | 'chave' | 'anexo'>>,
    usuario: Usuario,
  ): ResultadoLancamento & { lancamento: LancamentoMock } {
    travaPeriodo.exigirAberto(dados.data)
    const avisos: string[] = []
    for (const linha of agrupar(dados.contas)) {
      const c = this.contaMock(linha.contaId)
      if (!c.ativa) throw regra('CONTA_INATIVA', `A conta ${c.nome} está inativa.`)
      if (dados.data < c.dataCorte) {
        throw regra('ANTES_DA_DATA_DE_CORTE', `A data ${dataBr(dados.data)} é anterior à data de corte de ${c.nome} (${dataBr(c.dataCorte)}).`)
      }
      if (linha.valor >= 0) continue
      const atual = this.saldoCentavos(c.id)
      const depois = atual + linha.valor
      if (depois < 0) {
        if (c.tipo !== 'BANCO') {
          throw regra('SALDO_INSUFICIENTE', `O saldo de ${c.nome} ficaria negativo (${brl(depois)}). Saldo atual: ${brl(atual)}.`)
        }
        avisos.push(`O saldo de ${c.nome} ficou negativo: ${brl(depois)}.`)
      }
    }
    const lancamento = this.novo(dados, usuario.nome)
    this.registros.push(lancamento)
    return { id: lancamento.id, avisos, lancamento }
  }

  private novo(dados: Parameters<BancoFinanceiro['gravar']>[0], usuario: string): LancamentoMock {
    return {
      estorna: null,
      corrige: null,
      motivo: null,
      referencia: null,
      chave: null,
      anexo: null,
      ...dados,
      id: this.proximoId++,
      usuario,
      criadoEm: hoje().toISOString(),
      historico: [],
    }
  }

  private estornarLancamento(original: LancamentoMock, descricao: string, motivo: string | null, usuario: Usuario) {
    if (original.estorna !== null) throw regra('ESTORNO_NAO_ESTORNAVEL', 'Um estorno não pode ser estornado.')
    if (this.estornoDe(original.id)) throw regra('LANCAMENTO_JA_ESTORNADO', 'Este lançamento já foi estornado.')
    return this.gravar(
      {
        // US-CLOSING-008: o estorno do que aconteceu num mês fechado cai hoje, no período aberto.
        data: travaPeriodo.estaFechado(original.data.slice(0, 7)) ? paraIsoData(hoje()) : original.data,
        origemTipo: original.origemTipo,
        origemId: original.origemId,
        descricao,
        estorna: original.id,
        motivo,
        contas: original.contas.map((c) => ({ ...c, valor: -c.valor })),
        categorias: original.categorias.map((c) => ({ ...c, valor: -c.valor })),
      },
      usuario,
    )
  }

  private corrigir(usuario: Usuario, original: LancamentoMock, c: Correcao): ResultadoLancamento {
    if (original.origemTipo === 'MANUAL') {
      return this.manual(
        usuario,
        {
          contaId: c.contaId ?? 0,
          data: c.data,
          tipo: c.tipo ?? 'DESPESA',
          categoria: c.categoria ?? '',
          valor: c.valor,
          descricao: c.descricao ?? '',
          anexo: original.anexo,
          chaveIdempotencia: '',
        },
        original.id,
      )
    }
    if (original.origemTipo === 'TRANSFERENCIA') {
      return this.transferencia(
        usuario,
        { contaOrigemId: c.contaId ?? 0, contaDestinoId: c.contaDestinoId ?? 0, valor: c.valor, data: c.data, descricao: c.descricao ?? '', chaveIdempotencia: '' },
        original.id,
      )
    }
    if (original.origemTipo === 'LIQUIDACAO_CARTAO') {
      return this.liquidacao(
        usuario,
        {
          contaBancariaId: c.contaId ?? 0,
          data: c.data,
          bruto: c.valor,
          taxa: c.taxa ?? 0,
          // A correção mantém o tipo liquidado informado na original.
          tipoCartao: original.contas.find((l) => l.tipoCartao)?.tipoCartao ?? null,
          referencia: c.referencia ?? '',
          chaveIdempotencia: '',
        },
        original.id,
      )
    }
    throw regra('CORRECAO_NAO_DISPONIVEL', 'Registre o lançamento correto no módulo que gerou o original.')
  }

  private transferencia(usuario: Usuario, d: NovaTransferencia, corrige: number | null): ResultadoLancamento {
    this.exigirData(d.data)
    this.exigirPositivo(d.valor, 'valor')
    if (!d.contaOrigemId) throw validacao('contaOrigemId', 'Escolha a conta de origem.')
    if (!d.contaDestinoId) throw validacao('contaDestinoId', 'Escolha a conta de destino.')
    if (d.contaOrigemId === d.contaDestinoId) throw validacao('contaDestinoId', 'Escolha uma conta de destino diferente da origem.')
    const origem = this.contaMock(d.contaOrigemId)
    const destino = this.contaMock(d.contaDestinoId)
    if (origem.tipo === 'CARTAO_A_RECEBER' || destino.tipo === 'CARTAO_A_RECEBER') {
      throw regra('TRANSFERENCIA_CARTAO', 'Cartão a receber não entra em transferências: ele só sai pela liquidação de cartão.')
    }
    const valor = centavos(d.valor)
    return this.gravar(
      {
        data: d.data,
        origemTipo: 'TRANSFERENCIA',
        origemId: null,
        descricao: d.descricao.trim() || `Transferência de ${origem.nome} para ${destino.nome}`,
        corrige,
        chave: d.chaveIdempotencia || null,
        contas: [{ contaId: origem.id, valor: -valor }, { contaId: destino.id, valor }],
        categorias: [],
      },
      usuario,
    )
  }

  private liquidacao(usuario: Usuario, d: NovaLiquidacao, corrige: number | null): ResultadoLancamento {
    this.exigirData(d.data)
    if (!d.contaBancariaId) throw validacao('contaBancariaId', 'Escolha a conta bancária que recebeu o depósito.')
    this.exigirPositivo(d.bruto, 'bruto')
    if (d.taxa === null || d.taxa === undefined || d.taxa < 0 || !duasCasas(d.taxa)) {
      throw validacao('taxa', 'Informe a taxa (zero ou mais, com até duas casas decimais).')
    }
    const bruto = centavos(d.bruto)
    const taxa = centavos(d.taxa)
    if (taxa >= bruto) throw validacao('taxa', 'A taxa deve ser menor que o valor bruto.')
    const saldoCartao = this.saldoCentavos(CARTAO.id)
    if (bruto > saldoCartao) {
      throw regra('BRUTO_EXCEDE_CARTAO_A_RECEBER', `O bruto de ${brl(bruto)} excede o saldo de Cartão a receber de ${brl(saldoCartao)}.`)
    }
    const banco = this.contaMock(d.contaBancariaId)
    if (banco.tipo !== 'BANCO') throw validacao('contaBancariaId', 'Escolha a conta bancária que recebeu o depósito.')
    const ref = d.referencia.trim()
    return this.gravar(
      {
        data: d.data,
        origemTipo: 'LIQUIDACAO_CARTAO',
        origemId: null,
        descricao: `Liquidação de cartão${d.tipoCartao ? ` de ${d.tipoCartao === 'CREDITO' ? 'crédito' : 'débito'}` : ''}: bruto ${brl(bruto)}, taxa ${brl(taxa)}${ref ? ` (lote ${ref})` : ''}`,
        corrige,
        referencia: ref || null,
        chave: d.chaveIdempotencia || null,
        contas: [{ contaId: CARTAO.id, valor: -bruto, tipoCartao: d.tipoCartao ?? null }, { contaId: banco.id, valor: bruto - taxa }],
        categorias: taxa > 0 ? [{ categoria: CATEGORIA.TAXAS_CARTAO, valor: -taxa }] : [],
      },
      usuario,
    )
  }

  private manual(usuario: Usuario, d: NovoLancamentoManual, corrige: number | null): ResultadoLancamento {
    this.exigirData(d.data)
    if (!d.contaId) throw validacao('contaId', 'Escolha a conta.')
    const c = this.contaMock(d.contaId)
    if (c.tipo === 'CARTAO_A_RECEBER') throw validacao('contaId', 'Escolha um caixa ou uma conta bancária.')
    const cat = CATEGORIAS.find((x) => x.codigo === d.categoria)
    if (!cat || !cat.categoriaPai || !cat.ativa || FLUXO_PROPRIO.has(cat.codigo) || cat.tipo !== d.tipo) {
      throw validacao('categoria', `Escolha uma subcategoria ativa de ${d.tipo === 'DESPESA' ? 'despesa' : 'receita'} disponível para lançamento manual.`)
    }
    this.exigirPositivo(d.valor, 'valor')
    const descricao = d.descricao.trim().replace(/\s+/g, ' ')
    if (!descricao || descricao.length > 200) throw validacao('descricao', 'Descreva o lançamento (até 200 caracteres).')
    const valor = d.tipo === 'RECEITA' ? centavos(d.valor) : -centavos(d.valor)
    return this.gravar(
      {
        data: d.data,
        origemTipo: 'MANUAL',
        origemId: null,
        descricao,
        corrige,
        chave: d.chaveIdempotencia || null,
        anexo: d.anexo,
        contas: [{ contaId: c.id, valor }],
        categorias: [{ categoria: cat.codigo, valor }],
      },
      usuario,
    )
  }

  private idempotente(chave: string, registrar: () => ResultadoLancamento): ResultadoLancamento {
    const existente = chave ? this.registros.find((l) => l.chave === chave) : undefined
    if (existente) return { id: existente.id, avisos: [] }
    const { id, avisos } = registrar()
    return { id, avisos }
  }

  private exigirData(data: string) {
    if (!data) throw validacao('data', 'Informe a data.')
    if (data > paraIsoData(hoje())) throw validacao('data', 'A data não pode ser futura.')
  }

  private exigirPositivo(valor: number, campo: string) {
    if (!(valor > 0)) throw validacao(campo, 'Informe um valor maior que zero.')
    if (!duasCasas(valor)) throw validacao(campo, 'Use no máximo duas casas decimais.')
  }

  private validarDados(tipo: TipoConta, d: DadosConta) {
    const erros = []
    if (!d.nome.trim() || d.nome.trim().length > 100) erros.push({ campo: 'nome', mensagem: 'Informe o nome da conta (até 100 caracteres).' })
    if (tipo === 'BANCO') {
      if (!d.banco.trim()) erros.push({ campo: 'banco', mensagem: 'Informe o banco.' })
      if (!d.agencia.trim()) erros.push({ campo: 'agencia', mensagem: 'Informe a agência.' })
      if (!d.numeroConta.trim()) erros.push({ campo: 'numeroConta', mensagem: 'Informe o número da conta.' })
    }
    if (d.saldoInicial === null || Number.isNaN(d.saldoInicial)) {
      erros.push({ campo: 'saldoInicial', mensagem: 'Informe o saldo inicial (pode ser zero).' })
    } else if (tipo !== 'BANCO' && d.saldoInicial < 0) {
      erros.push({ campo: 'saldoInicial', mensagem: 'O saldo inicial do caixa não pode ser negativo.' })
    }
    if (!d.dataCorte) erros.push({ campo: 'dataCorte', mensagem: 'Informe a data de corte.' })
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
  }

  private camposDe(d: DadosConta): Partial<ContaMock> {
    const opcional = (v: string) => v.trim() || null
    return {
      localizacao: opcional(d.localizacao),
      banco: opcional(d.banco),
      agencia: opcional(d.agencia),
      numeroConta: opcional(d.numeroConta),
      saldoInicial: d.saldoInicial,
      dataCorte: d.dataCorte,
    }
  }

  private exigirForaDoRecebimento(c: ContaMock, acao: string): void {
    if (c.id === this.recebimento.dinheiro || c.id === this.recebimento.pix) {
      throw regra('CONTA_DE_RECEBIMENTO', `${c.nome} recebe os pagamentos das vendas e contribuições. Defina outra conta de recebimento antes de ${acao}.`)
    }
  }

  /** "banco-a" ou "caixa-cantina": gerado do nome, com sufixo numérico se já existir. */
  private codigoDoNome(tipo: TipoConta, nome: string): string {
    const prefixo = tipo === 'BANCO' ? 'banco-' : 'caixa-'
    let nucleo = nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (nucleo.startsWith(prefixo)) nucleo = nucleo.slice(prefixo.length)
    const base = `${prefixo}${nucleo.slice(0, 40) || 'conta'}`.replace(/-$/, '')
    let codigo = base
    for (let i = 2; CONTAS.some((c) => c.codigo === codigo); i++) codigo = `${base}-${i}`
    return codigo
  }

  /**
   * O saldo inicial é o da data de corte; o histórico importado (antes do corte) já está nele: depois
   * do corte somam-se as linhas até a data, antes dele tiram-se as importadas entre a data e o corte.
   */
  private saldoCentavos(contaId: number, ate?: string, antesDe?: string): number {
    const c = CONTAS.find((x) => x.id === contaId)
    const inicial = c ? centavos(c.saldoInicial) : 0
    const corte = c?.dataCorte ?? ''
    const dentro = (data: string) => (!ate || data <= ate) && (!antesDe || data < antesDe)
    return (
      inicial +
      soma(
        this.registros.map((l) => {
          const v = this.valorNaConta(l, contaId)
          if (l.data >= corte) return dentro(l.data) ? v : 0
          return dentro(l.data) ? 0 : -v
        }),
      )
    )
  }

  private valorNaConta(l: LancamentoMock, contaId: number): number {
    return soma(l.contas.filter((c) => c.contaId === contaId).map((c) => c.valor))
  }

  private temLancamentos(contaId: number): boolean {
    return this.registros.some((l) => l.contas.some((c) => c.contaId === contaId))
  }

  private estornoDe(id: number): LancamentoMock | undefined {
    return this.registros.find((l) => l.estorna === id)
  }

  private contaMock(id: number): ContaMock {
    const c = CONTAS.find((x) => x.id === id)
    if (!c) throw new ErroNegocio(404, 'CONTA_NAO_ENCONTRADA', 'Conta não encontrada.')
    return c
  }

  private lancamentoMock(id: number): LancamentoMock {
    const l = this.registros.find((x) => x.id === id)
    if (!l) throw new ErroNegocio(404, 'LANCAMENTO_NAO_ENCONTRADO', 'Lançamento não encontrado.')
    return l
  }

  private naConta(l: LancamentoMock, contaId: number): LancamentoNaConta {
    const estorno = this.estornoDe(l.id)
    return {
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      origemTipo: l.origemTipo,
      origemId: l.origemId,
      natureza: natureza(l),
      valor: reais(this.valorNaConta(l, contaId)),
      estornaLancamentoId: l.estorna,
      estornadoPorId: estorno?.id ?? null,
      corrigeLancamentoId: l.corrige,
      podeCorrigir: ESTORNAVEIS.has(l.origemTipo) && l.estorna === null && !estorno,
    }
  }

  private paraConta(c: ContaMock, comSaldo = true): ContaFinanceira {
    return {
      id: c.id,
      codigo: c.codigo,
      nome: c.nome,
      tipo: c.tipo,
      ativa: c.ativa,
      localizacao: c.localizacao,
      banco: c.banco,
      agencia: c.agencia,
      numeroConta: c.numeroConta,
      saldoInicial: c.saldoInicial,
      dataCorte: c.dataCorte,
      saldo: comSaldo ? this.saldo(c.id) : null,
      temLancamentos: comSaldo ? this.temLancamentos(c.id) : null,
    }
  }

  private paraCategoria(codigo: string): Categoria {
    const c = CATEGORIAS.find((x) => x.codigo === codigo)
    if (!c) return { codigo, nome: codigo, tipo: 'RECEITA', categoriaPai: null, nomeCompleto: codigo, ativa: false, permiteManual: false }
    const pai = c.categoriaPai ? CATEGORIAS.find((x) => x.codigo === c.categoriaPai) : undefined
    return {
      ...c,
      nomeCompleto: pai ? `${pai.nome} › ${c.nome}` : c.nome,
      permiteManual: c.categoriaPai !== null && !FLUXO_PROPRIO.has(c.codigo),
    }
  }
}

function ordemTipo(tipo: TipoConta): number {
  return ['CAIXA', 'BANCO', 'CARTAO_A_RECEBER'].indexOf(tipo)
}

function agrupar(linhas: LinhaConta[]): LinhaConta[] {
  const porConta = new Map<number, number>()
  const tipos = new Map<number, TipoCartao>()
  for (const l of linhas) {
    porConta.set(l.contaId, (porConta.get(l.contaId) ?? 0) + l.valor)
    if (l.tipoCartao) tipos.set(l.contaId, l.tipoCartao)
  }
  return [...porConta.entries()].filter(([, v]) => v !== 0).map(([contaId, valor]) => ({ contaId, valor, tipoCartao: tipos.get(contaId) ?? null }))
}

function natureza(l: LancamentoMock): NaturezaLancamento {
  if (l.estorna !== null) return 'ESTORNO'
  if (l.origemTipo === 'LIQUIDACAO_CARTAO') return 'LIQUIDACAO'
  if (l.categorias.length === 0) return 'TRANSFERENCIA'
  return soma(l.categorias.map((c) => c.valor)) > 0 ? 'RECEITA' : 'DESPESA'
}

/** Mesma regra do backend: categorias, bruto da liquidação ou valor transferido. */
function valorPrincipal(l: LancamentoMock): number {
  if (l.categorias.length > 0 && l.origemTipo !== 'LIQUIDACAO_CARTAO') return soma(l.categorias.map((c) => c.valor))
  if (l.origemTipo === 'LIQUIDACAO_CARTAO') {
    const maior = l.contas.reduce((m, c) => (Math.abs(c.valor) > Math.abs(m) ? c.valor : m), 0)
    return -maior
  }
  const transferido = soma(l.contas.filter((c) => c.valor > 0).map((c) => c.valor))
  return l.estorna === null ? transferido : -transferido
}

export const bancoFinanceiro = new BancoFinanceiro()
