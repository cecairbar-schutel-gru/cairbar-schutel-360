import type { Usuario } from '../auth'
import type { TipoConta } from '../features/financeiro/types'
import type {
  AcertoEditora,
  Agrupamento,
  FiltroContagem,
  FiltroEstoqueRelatorio,
  FiltroFluxo,
  FiltroMensalidades,
  FiltroSaldos,
  FiltroVendasRelatorio,
  FluxoCaixa,
  FolhaContagem,
  GrupoCategoria,
  LinhaCategoria,
  LinhaEstoque,
  LinhaFluxo,
  Periodo,
  ProdutoNoRelatorio,
  ReceitasDespesas,
  RecebimentoMensalidades,
  RelatorioEditoras,
  RelatorioEstoque,
  RelatorioMensalidades,
  RelatorioVendas,
  SaldoContaRelatorio,
  SaldosPorConta,
  SituacaoCompetencias,
  TotaisSaldos,
} from '../features/relatorios/types'
import type { MeioRelatorioVendas } from '../features/relatorios/types'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { bancoConciliacoes } from './bancoConciliacoes'
import { bancoContribuicoes } from './bancoContribuicoes'
import { bancoDoadores } from './bancoDoadores'
import { bancoEditoras } from './bancoEditoras'
import { bancoEstoque } from './bancoEstoque'
import { bancoFinanceiro, CONTAS } from './bancoFinanceiro'
import { bancoVendas } from './bancoVendas'
import { EDITORAS, REMESSAS } from './cadastroEditoras'
import { ErroNegocio } from './erroNegocio'

const reais = (c: number) => c / 100
const centavos = (v: number) => Math.round(v * 100)
const validacao = (campo: string, mensagem: string) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const iso = /^\d{4}-\d{2}-\d{2}$/
const isoMes = /^\d{4}-\d{2}$/

function deslocarDia(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return paraIsoData(new Date(a, m - 1, d + dias))
}

function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return paraIsoData(new Date(a, m, 0))
}

function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `PeriodoRelatorio.ouMesDe` do backend: sem datas, o mês atual. */
function periodo(de?: string | null, ate?: string | null): Periodo {
  if (!de && !ate) {
    const mes = paraIsoData(hoje()).slice(0, 7)
    return { de: `${mes}-01`, ate: ultimoDiaDoMes(mes) }
  }
  if (!de || !iso.test(de)) throw validacao('de', 'Informe a data inicial.')
  if (!ate || !iso.test(ate)) throw validacao('ate', 'Informe a data final.')
  if (de > ate) throw validacao('ate', 'A data final deve ser igual ou posterior à inicial.')
  return { de, ate }
}

/** Participação em %, com uma casa (arredondamento como o HALF_UP do backend); nula com total zero. */
function percentual(parte: number, total: number): number | null {
  if (total === 0) return null
  const x = (parte * 100) / total
  return (Math.sign(x) * Math.round(Math.abs(x) * 10 + 1e-9)) / 10
}

/** `Rateio.proporcional`: maiores restos, a soma das partes é o total. */
function ratear<K>(total: number, pesos: Map<K, number>): Map<K, number> {
  const partes = new Map<K, number>()
  const somaPesos = [...pesos.values()].reduce((s, v) => s + v, 0)
  if (somaPesos === 0) {
    for (const k of pesos.keys()) partes.set(k, 0)
    return partes
  }
  const restos: { chave: K; fracao: number }[] = []
  let distribuido = 0
  for (const [k, p] of pesos) {
    const exato = (total * p) / somaPesos
    const parte = exato < 0 ? Math.ceil(exato) : Math.floor(exato)
    partes.set(k, parte)
    distribuido += parte
    restos.push({ chave: k, fracao: Math.abs(exato - parte) })
  }
  let sobra = total - distribuido
  const passo = Math.sign(sobra)
  restos.sort((a, b) => b.fracao - a.fracao)
  for (let i = 0; sobra !== 0; i = (i + 1) % restos.length) {
    partes.set(restos[i].chave, partes.get(restos[i].chave)! + passo)
    sobra -= passo
  }
  return partes
}

interface Parcela {
  entradas: number
  saidas: number
  transferenciasEntrada: number
  transferenciasSaida: number
}
const ZERO: Parcela = { entradas: 0, saidas: 0, transferenciasEntrada: 0, transferenciasSaida: 0 }
const mais = (a: Parcela, b: Parcela): Parcela => ({
  entradas: a.entradas + b.entradas,
  saidas: a.saidas + b.saidas,
  transferenciasEntrada: a.transferenciasEntrada + b.transferenciasEntrada,
  transferenciasSaida: a.transferenciasSaida + b.transferenciasSaida,
})
const liquido = (p: Parcela) => p.entradas - p.saidas + p.transferenciasEntrada - p.transferenciasSaida

/**
 * `FluxoDeCaixa` do backend: as categorias explicam as linhas de conta do mesmo sinal,
 * proporcionalmente; o resto é transferência (a taxa da liquidação sai de Cartão a receber).
 */
class Fluxo {
  readonly entradas = new Map<string, number>()
  readonly saidas = new Map<string, number>()
  total: Parcela = ZERO
  private readonly contas: Set<number>
  private readonly receitas: Set<string>

  constructor(contas: Set<number>, receitas: Set<string>) {
    this.contas = contas
    this.receitas = receitas
  }

  somar(m: { contas: Map<number, number>; categorias: Map<string, number> }): Parcela {
    const totalCategorias = [...m.categorias.values()].reduce((s, v) => s + v, 0)
    const sinal = Math.sign(totalCategorias)
    const mesmoSinal = new Map([...m.contas].filter(([, v]) => sinal !== 0 && Math.sign(v) === sinal))
    const explicado = ratear(totalCategorias, mesmoSinal)
    let explicadoNasContas = 0
    let tEntrada = 0
    let tSaida = 0
    for (const [conta, valor] of m.contas) {
      if (!this.contas.has(conta)) continue
      const parte = explicado.get(conta) ?? 0
      explicadoNasContas += parte
      const transferencia = valor - parte
      if (transferencia > 0) tEntrada += transferencia
      else tSaida -= transferencia
    }
    let entrou = 0
    let saiu = 0
    if (explicadoNasContas !== 0) {
      for (const [codigo, valor] of ratear(explicadoNasContas, new Map(m.categorias))) {
        if (this.receitas.has(codigo)) {
          this.entradas.set(codigo, (this.entradas.get(codigo) ?? 0) + valor)
          entrou += valor
        } else {
          this.saidas.set(codigo, (this.saidas.get(codigo) ?? 0) - valor)
          saiu -= valor
        }
      }
    }
    const p = { entradas: entrou, saidas: saiu, transferenciasEntrada: tEntrada, transferenciasSaida: tSaida }
    this.total = mais(this.total, p)
    return p
  }
}

/** `ArvoreCategorias.montar`: valores em centavos, já positivos para o grupo. */
function arvore(tipo: 'RECEITA' | 'DESPESA', valores: Map<string, number>, planoTodo: boolean): GrupoCategoria[] {
  const plano = bancoFinanceiro.planoDeContas().filter((c) => c.tipo === tipo)
  const total = [...valores].filter(([k]) => plano.some((c) => c.codigo === k)).reduce((s, [, v]) => s + v, 0)
  const grupos: GrupoCategoria[] = []
  for (const mae of plano.filter((c) => c.categoriaPai === null)) {
    const subs: LinhaCategoria[] = []
    for (const sub of plano.filter((c) => c.categoriaPai === mae.codigo)) {
      if (!valores.has(sub.codigo) && !(planoTodo && sub.ativa)) continue
      const v = valores.get(sub.codigo) ?? 0
      subs.push({ codigo: sub.codigo, nome: sub.nome, ativa: sub.ativa, valor: reais(v), percentual: percentual(v, total) })
    }
    if (subs.length === 0) continue
    subs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const soma = subs.reduce((s, l) => s + centavos(l.valor), 0)
    grupos.push({ codigo: mae.codigo, nome: mae.nome, ativa: mae.ativa, valor: reais(soma), percentual: percentual(soma, total), subcategorias: subs })
  }
  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

const totalDe = (grupos: GrupoCategoria[]) => reais(grupos.reduce((s, g) => s + centavos(g.valor), 0))

function receitasDoPlano(): Set<string> {
  return new Set(bancoFinanceiro.planoDeContas().filter((c) => c.tipo === 'RECEITA').map((c) => c.codigo))
}

function linhaEstoque(origem: LinhaEstoque['origem']): LinhaEstoque {
  return { origem, remessaId: null, remessaCodigo: null, editoraId: null, editoraNome: null, inicial: 0, compra: 0, doacao: 0, remessa: 0, venda: 0, devolucao: 0, baixa: 0, ajuste: 0, fim: 0 }
}

const COLUNAS_ESTOQUE = ['compra', 'doacao', 'remessa', 'venda', 'devolucao', 'baixa', 'ajuste'] as const
type ColunaEstoque = (typeof COLUNAS_ESTOQUE)[number]

/** `ColunaEstoque.de` do backend; o estorno vai para a coluna do movimento estornado. */
function colunaDo(tipo: string, estornado: string | null): ColunaEstoque {
  if (tipo === 'ESTORNO') return estornado && estornado !== 'ESTORNO' ? colunaDo(estornado, null) : 'ajuste'
  switch (tipo) {
    case 'ENTRADA_COMPRA':
      return 'compra'
    case 'ENTRADA_DOACAO':
      return 'doacao'
    case 'ENTRADA_REMESSA':
      return 'remessa'
    case 'VENDA':
    case 'CANCELAMENTO_VENDA':
      return 'venda'
    case 'DEVOLUCAO_EDITORA':
      return 'devolucao'
    case 'BAIXA_VENCIMENTO':
    case 'BAIXA_DANO':
    case 'BAIXA_EXTRAVIO':
      return 'baixa'
    default:
      return 'ajuste'
  }
}
const SAIDAS = new Set<ColunaEstoque>(['venda', 'devolucao', 'baixa'])

/** Espelho simulado do módulo Relatórios do backend (US-REPORT-001 a 009). */
class BancoRelatorios {
  // US-REPORT-001

  fluxoCaixa(f: Partial<FiltroFluxo>): FluxoCaixa {
    const p = periodo(f.de, f.ate)
    const agrupamento: Agrupamento = f.agrupamento ?? 'MES'
    let contas = CONTAS
    if (f.contaId) {
      contas = CONTAS.filter((c) => c.id === f.contaId)
      if (contas.length === 0) throw new ErroNegocio(404, 'CONTA_NAO_ENCONTRADA', 'Conta não encontrada.')
    } else {
      contas = CONTAS.filter((c) => (!f.tipoConta || c.tipo === f.tipoConta) && c.dataCorte <= p.ate)
    }
    const abertura = bancoFinanceiro.saldosEm(deslocarDia(p.de, -1))
    let saldo = contas.reduce((s, c) => s + (abertura.get(c.id) ?? 0), 0)
    const inicial = saldo
    const fluxo = new Fluxo(new Set(contas.map((c) => c.id)), receitasDoPlano())
    const movimentos = bancoFinanceiro.linhasNoPeriodo(p.de, p.ate)
    const periodos: LinhaFluxo[] = []
    let i = 0
    for (const [inicio, fim] of intervalos(p, agrupamento)) {
      let parcela = ZERO
      while (i < movimentos.length && movimentos[i].data <= fim) parcela = mais(parcela, fluxo.somar(movimentos[i++]))
      const final = saldo + liquido(parcela)
      periodos.push({
        inicio,
        fim,
        saldoInicial: reais(saldo),
        entradas: reais(parcela.entradas),
        saidas: reais(parcela.saidas),
        transferenciasEntrada: reais(parcela.transferenciasEntrada),
        transferenciasSaida: reais(parcela.transferenciasSaida),
        saldoFinal: reais(final),
      })
      saldo = final
    }
    const entradas = arvore('RECEITA', fluxo.entradas, false)
    const saidas = arvore('DESPESA', fluxo.saidas, false)
    return {
      de: p.de,
      ate: p.ate,
      agrupamento,
      contaId: f.contaId ?? null,
      tipoConta: f.contaId ? null : (f.tipoConta ?? null),
      contas: contas.map((c) => ({ contaId: c.id, nome: c.nome, tipo: c.tipo })),
      saldoInicial: reais(inicial),
      entradas,
      totalEntradas: totalDe(entradas),
      saidas,
      totalSaidas: totalDe(saidas),
      transferenciasEntrada: reais(fluxo.total.transferenciasEntrada),
      transferenciasSaida: reais(fluxo.total.transferenciasSaida),
      saldoFinal: reais(saldo),
      periodos,
    }
  }

  // US-REPORT-002

  receitasDespesas(f: Partial<Periodo>): ReceitasDespesas {
    const p = periodo(f.de, f.ate)
    const plano = bancoFinanceiro.planoDeContas()
    const receitas = new Map<string, number>()
    const despesas = new Map<string, number>()
    for (const [codigo, valor] of bancoFinanceiro.somaPorCategoria(p.de, p.ate)) {
      const c = plano.find((x) => x.codigo === codigo)
      if (!c) continue
      if (c.tipo === 'RECEITA') receitas.set(codigo, valor)
      else despesas.set(codigo, -valor)
    }
    const r = arvore('RECEITA', receitas, true)
    const d = arvore('DESPESA', despesas, true)
    const totalReceitas = totalDe(r)
    const totalDespesas = totalDe(d)
    return { de: p.de, ate: p.ate, receitas: r, totalReceitas, despesas: d, totalDespesas, resultado: reais(centavos(totalReceitas) - centavos(totalDespesas)) }
  }

  // US-REPORT-003

  saldos(f: FiltroSaldos): SaldosPorConta {
    const conciliadas = bancoConciliacoes.conciliadasAte()
    const conciliadaAte = (id: number, tipo: TipoConta) => (tipo === 'BANCO' ? (conciliadas.get(id) ?? null) : null)
    if (f.data) {
      if (!iso.test(f.data)) throw validacao('data', 'Informe a data.')
      const saldos = bancoFinanceiro.saldosEm(f.data)
      const lista: SaldoContaRelatorio[] = CONTAS.filter((c) => c.dataCorte <= f.data! && (c.ativa || (saldos.get(c.id) ?? 0) !== 0)).map((c) => ({
        contaId: c.id,
        nome: c.nome,
        tipo: c.tipo,
        ativa: c.ativa,
        saldoInicial: null,
        entradas: null,
        saidas: null,
        transferenciasEntrada: null,
        transferenciasSaida: null,
        saldoFinal: reais(saldos.get(c.id) ?? 0),
        conciliadaAte: conciliadaAte(c.id, c.tipo),
      }))
      return this.quadro('DATA', null, f.data, lista)
    }
    const p = periodo(f.de, f.ate)
    const abertura = bancoFinanceiro.saldosEm(deslocarDia(p.de, -1))
    const fechamento = bancoFinanceiro.saldosEm(p.ate)
    const movimentos = bancoFinanceiro.linhasNoPeriodo(p.de, p.ate)
    const receitas = receitasDoPlano()
    const lista: SaldoContaRelatorio[] = []
    for (const c of CONTAS.filter((x) => x.dataCorte <= p.ate)) {
      const fluxo = new Fluxo(new Set([c.id]), receitas)
      movimentos.forEach((m) => fluxo.somar(m))
      const t = fluxo.total
      const inicial = abertura.get(c.id) ?? 0
      const fim = fechamento.get(c.id) ?? 0
      if (!c.ativa && inicial === 0 && fim === 0 && liquido(t) === 0 && t.entradas === 0 && t.saidas === 0) continue
      lista.push({
        contaId: c.id,
        nome: c.nome,
        tipo: c.tipo,
        ativa: c.ativa,
        saldoInicial: reais(inicial),
        entradas: reais(t.entradas),
        saidas: reais(t.saidas),
        transferenciasEntrada: reais(t.transferenciasEntrada),
        transferenciasSaida: reais(t.transferenciasSaida),
        saldoFinal: reais(fim),
        conciliadaAte: conciliadaAte(c.id, c.tipo),
      })
    }
    return this.quadro('PERIODO', p.de, p.ate, lista)
  }

  // US-REPORT-004

  mensalidades(f: Partial<FiltroMensalidades>): RelatorioMensalidades {
    const atual = paraIsoData(hoje()).slice(0, 7)
    const compAte = f.competenciaAte || atual
    const compDe = f.competenciaDe || deslocarMes(compAte, -5)
    if (!isoMes.test(compDe)) throw validacao('competenciaDe', 'Informe o mês no formato AAAA-MM.')
    if (!isoMes.test(compAte)) throw validacao('competenciaAte', 'Informe o mês no formato AAAA-MM.')
    if (compDe > compAte) throw validacao('competenciaAte', 'O mês final deve ser igual ou posterior ao inicial.')
    if (deslocarMes(compDe, 35) < compAte) throw validacao('competenciaAte', 'Escolha até 36 meses de competências.')
    const p = periodo(f.de, f.ate)
    const registros = bancoDoadores.todosOsRegistros()
    const todas = registros.flatMap((r) => r.competencias)

    const porCompetencia: SituacaoCompetencias[] = []
    for (let m = compDe; m <= compAte; m = deslocarMes(m, 1)) {
      const doMes = todas.filter((c) => c.competencia === m)
      const soma = (status?: string) => reais(doMes.filter((c) => !status || c.status === status).reduce((s, c) => s + centavos(c.valor), 0))
      porCompetencia.push(this.situacao({
        mes: m,
        geradas: doMes.length,
        pagas: doMes.filter((c) => c.status === 'PAGA').length,
        pendentes: doMes.filter((c) => c.status === 'PENDENTE').length,
        canceladas: doMes.filter((c) => c.status === 'CANCELADA').length,
        valorGerado: soma(),
        valorPago: soma('PAGA'),
        valorPendente: soma('PENDENTE'),
      }))
    }
    const somar = (campo: 'geradas' | 'pagas' | 'pendentes' | 'canceladas') => porCompetencia.reduce((s, x) => s + x[campo], 0)
    const somarValor = (campo: 'valorGerado' | 'valorPago' | 'valorPendente') => reais(porCompetencia.reduce((s, x) => s + centavos(x[campo]), 0))
    const totalCompetencias = this.situacao({
      mes: null,
      geradas: somar('geradas'),
      pagas: somar('pagas'),
      pendentes: somar('pendentes'),
      canceladas: somar('canceladas'),
      valorGerado: somarValor('valorGerado'),
      valorPago: somarValor('valorPago'),
      valorPendente: somarValor('valorPendente'),
    })

    // Recebidas no período e canceladas no período (na data do estorno), como no backend.
    const eventos: { data: string; competencia: string; valor: number; estorno: boolean }[] = []
    for (const c of bancoContribuicoes.todas()) {
      for (const comp of c.competencias) {
        if (c.data >= p.de && c.data <= p.ate) eventos.push({ data: c.data, competencia: comp.mes, valor: comp.valor, estorno: false })
        if (c.status === 'CANCELADA') {
          const data = bancoFinanceiro.dataDoEstorno('CONTRIBUICAO', c.id)
          if (data && data >= p.de && data <= p.ate) eventos.push({ data, competencia: comp.mes, valor: comp.valor, estorno: true })
        }
      }
    }
    const vazio = (mes: string | null): RecebimentoMensalidades => ({
      mes,
      atrasadas: { quantidade: 0, valor: 0 },
      mesCorrente: { quantidade: 0, valor: 0 },
      antecipadas: { quantidade: 0, valor: 0 },
      total: { quantidade: 0, valor: 0 },
    })
    const somarRecebimento = (r: RecebimentoMensalidades, e: (typeof eventos)[number]) => {
      const q = e.estorno ? -1 : 1
      const v = e.estorno ? -e.valor : e.valor
      const mesRecebido = e.data.slice(0, 7)
      const classe = e.competencia < mesRecebido ? 'atrasadas' : e.competencia === mesRecebido ? 'mesCorrente' : 'antecipadas'
      for (const chave of [classe, 'total'] as const) {
        r[chave] = { quantidade: r[chave].quantidade + q, valor: reais(centavos(r[chave].valor) + centavos(v)) }
      }
    }
    const porMes = new Map<string, RecebimentoMensalidades>()
    const geral = vazio(null)
    for (const e of eventos) {
      const mes = e.data.slice(0, 7)
      if (!porMes.has(mes)) porMes.set(mes, vazio(mes))
      somarRecebimento(porMes.get(mes)!, e)
      somarRecebimento(geral, e)
    }

    const doadoresComPendencias = registros
      .filter((r) => r.doador.status === 'ATIVO')
      .map((r) => {
        const pendentes = r.competencias.filter((c) => c.status === 'PENDENTE' && c.competencia <= atual)
        const pagas = r.competencias.filter((c) => c.status === 'PAGA' && c.dataPagamento).map((c) => c.dataPagamento!).sort()
        return {
          doadorId: r.doador.id,
          nome: r.doador.nome,
          pendentes: pendentes.length,
          valorPendente: reais(pendentes.reduce((s, c) => s + centavos(c.valor), 0)),
          ultimoPagamento: pagas.at(-1) ?? null,
        }
      })
      .filter((d) => d.pendentes >= 3)
      .sort((a, b) => b.pendentes - a.pendentes || b.valorPendente - a.valorPendente || a.nome.localeCompare(b.nome, 'pt-BR'))

    return {
      competenciaDe: compDe,
      competenciaAte: compAte,
      porCompetencia,
      totalCompetencias,
      de: p.de,
      ate: p.ate,
      recebimentosPorMes: [...porMes.values()].sort((a, b) => a.mes!.localeCompare(b.mes!)),
      recebimentos: geral,
      doadoresComPendencias,
    }
  }

  // US-REPORT-006

  vendas(usuario: Usuario, f: Partial<FiltroVendasRelatorio>): RelatorioVendas {
    const p = periodo(f.de, f.ate)
    const veTodos = usuario.papeis.includes('tesoureiro') || usuario.papeis.includes('administrador')
    const dentro = (d: string | null) => d !== null && d >= p.de && d <= p.ate
    const eventos = bancoVendas
      .todas()
      .filter((v) => veTodos || v.vendedorId === usuario.id || v.pdv)
      .flatMap((v) => {
        const lista: { venda: typeof v; cancelamento: boolean }[] = []
        if (dentro(v.data)) lista.push({ venda: v, cancelamento: false })
        if (v.status === 'CANCELADA' && dentro(bancoFinanceiro.dataDoEstorno('VENDA', v.id))) lista.push({ venda: v, cancelamento: true })
        return lista
      })
    let vendas = 0
    let canceladas = 0
    let bruto = 0
    let cancelado = 0
    let livros = 0
    let cantina = 0
    // Cartão sem tipo (vendas antigas) entra no fim, só quando houver.
    const porMeio = new Map<MeioRelatorioVendas, number>([['DINHEIRO', 0], ['PIX', 0], ['CARTAO_CREDITO', 0], ['CARTAO_DEBITO', 0]])
    const porProduto = new Map<number, RelatorioVendas['porProduto'][number]>()
    const porVendedor = new Map<string, RelatorioVendas['porVendedor'][number]>()
    for (const { venda: v, cancelamento } of eventos) {
      const sinal = cancelamento ? -1 : 1
      const total = centavos(v.total)
      if (cancelamento) {
        canceladas++
        cancelado += total
      } else {
        vendas++
        bruto += total
      }
      for (const i of v.itens) {
        const valor = sinal * centavos(i.precoUnitario * i.quantidade)
        if (i.tipo === 'LIVRO') livros += valor
        else cantina += valor
        const atual = porProduto.get(i.produtoId) ?? { produtoId: i.produtoId, nome: i.produtoNome, tipo: i.tipo, quantidade: 0, valor: 0 }
        porProduto.set(i.produtoId, { ...atual, quantidade: atual.quantidade + sinal * i.quantidade, valor: reais(centavos(atual.valor) + valor) })
      }
      for (const pg of v.pagamentos) {
        const meio: MeioRelatorioVendas = pg.meio === 'CARTAO' && pg.tipoCartao ? `CARTAO_${pg.tipoCartao}` : pg.meio
        porMeio.set(meio, (porMeio.get(meio) ?? 0) + sinal * centavos(pg.valor))
      }
      const c = porVendedor.get(v.vendedorId) ?? { vendedorSubject: v.vendedorId, nome: v.vendedorNome, vendas: 0, bruto: 0, canceladas: 0, cancelado: 0, liquido: 0 }
      porVendedor.set(v.vendedorId, cancelamento
        ? { ...c, canceladas: c.canceladas + 1, cancelado: reais(centavos(c.cancelado) + total), liquido: reais(centavos(c.liquido) - total) }
        : { ...c, vendas: c.vendas + 1, bruto: reais(centavos(c.bruto) + total), liquido: reais(centavos(c.liquido) + total) })
    }
    return {
      de: p.de,
      ate: p.ate,
      vendas,
      receitaBruta: reais(bruto),
      canceladas,
      valorCancelado: reais(cancelado),
      receitaLiquida: reais(bruto - cancelado),
      livros: reais(livros),
      cantina: reais(cantina),
      porMeio: [...porMeio].map(([meio, valor]) => ({ meio, valor: reais(valor) })),
      porProduto: [...porProduto.values()]
        .filter((x) => x.quantidade !== 0 || x.valor !== 0)
        .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR')),
      porVendedor: [...porVendedor.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }
  }

  // US-REPORT-007

  estoque(f: Partial<FiltroEstoqueRelatorio>): RelatorioEstoque {
    const p = periodo(f.de, f.ate)
    const produtos = this.produtos(f)
    const ids = new Set(produtos.map((x) => x.id))
    const diaDo = (instante: string) => paraIsoData(new Date(instante))
    const lotes = new Map<string, { base: LinhaEstoque; produtoId: number; atual: number; noPeriodo: number; depois: number }>()
    const chave = (produtoId: number, remessaId: number | null) => `${produtoId}:${remessaId}`
    const lote = (produtoId: number, remessaId: number | null) => {
      const k = chave(produtoId, remessaId)
      if (!lotes.has(k)) {
        const remessa = remessaId === null ? null : REMESSAS.find((r) => r.id === remessaId)
        const editora = remessa ? EDITORAS.find((e) => e.id === remessa.editoraId) : undefined
        lotes.set(k, {
          base: { ...linhaEstoque(remessaId === null ? 'PROPRIO' : 'CONSIGNADO'), remessaId, remessaCodigo: remessa?.codigo ?? null, editoraId: editora?.id ?? null, editoraNome: editora?.nome ?? null },
          produtoId,
          atual: 0,
          noPeriodo: 0,
          depois: 0,
        })
      }
      return lotes.get(k)!
    }
    for (const l of bancoEstoque.todosOsLotes().filter((x) => ids.has(x.produtoId))) lote(l.produtoId, l.remessaId).atual = l.quantidade
    const baixas = new Map([['VENCIMENTO', 0], ['DANO', 0], ['EXTRAVIO', 0]] as [string, number][])
    const movimentos = bancoEstoque.todosOsMovimentos()
    for (const m of movimentos.filter((x) => ids.has(x.produtoId))) {
      const d = diaDo(m.ocorridoEm)
      if (d < p.de) continue
      const l = lote(m.produtoId, m.remessaId)
      if (d > p.ate) {
        l.depois += m.quantidade
        continue
      }
      const estornado = m.estornaMovimentoId ? (movimentos.find((x) => x.id === m.estornaMovimentoId)?.tipo ?? null) : null
      const coluna = colunaDo(m.tipo, estornado)
      l.base[coluna] += SAIDAS.has(coluna) ? -m.quantidade : m.quantidade
      l.noPeriodo += m.quantidade
      const tipoBaixa = m.tipo === 'ESTORNO' ? estornado : m.tipo
      if (tipoBaixa?.startsWith('BAIXA_')) {
        const motivo = tipoBaixa.slice('BAIXA_'.length)
        baixas.set(motivo, (baixas.get(motivo) ?? 0) - m.quantidade)
      }
    }
    const somarLinhas = (a: LinhaEstoque, b: LinhaEstoque): LinhaEstoque => {
      const r = { ...linhaEstoque('TOTAL'), inicial: a.inicial + b.inicial, fim: a.fim + b.fim }
      for (const c of COLUNAS_ESTOQUE) r[c] = a[c] + b[c]
      return r
    }
    const semMovimento = (l: LinhaEstoque) => COLUNAS_ESTOQUE.every((c) => l[c] === 0)
    const vazia = (l: LinhaEstoque) => semMovimento(l) && l.inicial === 0 && l.fim === 0
    const lista: ProdutoNoRelatorio[] = []
    let total = linhaEstoque('TOTAL')
    for (const produto of produtos) {
      let origens = [...lotes.values()]
        .filter((l) => l.produtoId === produto.id)
        .sort((a, b) => Number(a.base.remessaId !== null) - Number(b.base.remessaId !== null) || (a.base.remessaCodigo ?? '').localeCompare(b.base.remessaCodigo ?? ''))
        .map((l) => ({ ...l.base, fim: l.atual - l.depois, inicial: l.atual - l.depois - l.noPeriodo }))
        .filter((l) => !vazia(l))
      if (origens.length === 0) origens = [linhaEstoque('PROPRIO')]
      const soma = origens.reduce(somarLinhas, linhaEstoque('TOTAL'))
      if (f.somenteComMovimento && semMovimento(soma)) continue
      if (!produto.ativo && vazia(soma)) continue
      lista.push({
        produtoId: produto.id,
        nome: produto.nome,
        tipo: produto.tipo,
        categoria: produto.categoria,
        autor: produto.autor,
        editoraNome: EDITORAS.find((e) => e.id === produto.editoraId)?.nome ?? null,
        ativo: produto.ativo,
        origens,
        total: soma,
      })
      total = somarLinhas(total, soma)
    }
    return {
      de: p.de,
      ate: p.ate,
      tipo: f.tipo ?? null,
      categoria: f.categoria?.trim() || null,
      editoraId: f.editoraId ?? null,
      somenteComMovimento: !!f.somenteComMovimento,
      produtos: lista,
      total,
      baixasPorMotivo: [...baixas].map(([motivo, quantidade]) => ({ motivo: motivo as 'VENCIMENTO' | 'DANO' | 'EXTRAVIO', quantidade })),
    }
  }

  contagem(f: FiltroContagem): FolhaContagem {
    const lotes = bancoEstoque.todosOsLotes()
    const itens = this.produtos(f)
      .map((p) => {
        const proprio = lotes.filter((l) => l.produtoId === p.id && l.remessaId === null).reduce((s, l) => s + l.quantidade, 0)
        const consignado = lotes.filter((l) => l.produtoId === p.id && l.remessaId !== null).reduce((s, l) => s + l.quantidade, 0)
        return {
          produtoId: p.id,
          nome: p.nome,
          tipo: p.tipo,
          categoria: p.categoria,
          autor: p.autor,
          editoraNome: EDITORAS.find((e) => e.id === p.editoraId)?.nome ?? null,
          proprio,
          consignado,
          quantidade: proprio + consignado,
          ativo: p.ativo,
        }
      })
      .filter((i) => i.ativo || i.quantidade > 0)
      .map(({ ativo: _ativo, ...i }) => i)
    return { data: paraIsoData(hoje()), tipo: f.tipo ?? null, categoria: f.categoria?.trim() || null, editoraId: f.editoraId ?? null, itens }
  }

  // US-REPORT-009

  editoras(f: Partial<Periodo>): RelatorioEditoras {
    const p = periodo(f.de, f.ate)
    const editoras: AcertoEditora[] = bancoEditoras
      .acertos(p.de, p.ate)
      .map((a) => ({
        ...a,
        saldoFinal: reais(centavos(a.saldoInicial) + centavos(a.obrigacoesVendas) + centavos(a.obrigacoesBaixas) - centavos(a.estornos) - centavos(a.pagamentos)),
      }))
      .filter((a) => [a.saldoInicial, a.obrigacoesVendas, a.obrigacoesBaixas, a.estornos, a.pagamentos, a.saldoFinal].some((v) => v !== 0))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const somar = (campo: keyof Omit<AcertoEditora, 'editoraId' | 'nome'>) => reais(editoras.reduce((s, e) => s + centavos(e[campo]), 0))
    return {
      de: p.de,
      ate: p.ate,
      editoras,
      total: {
        editoraId: null,
        nome: 'Total',
        saldoInicial: somar('saldoInicial'),
        obrigacoesVendas: somar('obrigacoesVendas'),
        obrigacoesBaixas: somar('obrigacoesBaixas'),
        estornos: somar('estornos'),
        pagamentos: somar('pagamentos'),
        transferido: somar('transferido'),
        saldoFinal: somar('saldoFinal'),
      },
    }
  }

  // Apoio

  private produtos(f: FiltroContagem) {
    const categoria = f.categoria?.trim().toLowerCase()
    return bancoEstoque
      .todos()
      .filter((p) => (!f.tipo || p.tipo === f.tipo) && (!categoria || p.categoria?.toLowerCase() === categoria) && (!f.editoraId || p.editoraId === f.editoraId))
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  private situacao(c: Omit<SituacaoCompetencias, 'taxaPagamento'>): SituacaoCompetencias {
    return { ...c, taxaPagamento: percentual(c.pagas, c.geradas - c.canceladas) }
  }

  private quadro(modo: 'PERIODO' | 'DATA', de: string | null, ate: string, lista: SaldoContaRelatorio[]): SaldosPorConta {
    const totais = (contas: SaldoContaRelatorio[]): TotaisSaldos => {
      const somar = (f: (s: SaldoContaRelatorio) => number | null) => reais(contas.reduce((s, c) => s + centavos(f(c) ?? 0), 0))
      const fim = somar((c) => c.saldoFinal)
      if (modo === 'DATA') return { saldoInicial: null, entradas: null, saidas: null, transferenciasEntrada: null, transferenciasSaida: null, saldoFinal: fim }
      return {
        saldoInicial: somar((c) => c.saldoInicial),
        entradas: somar((c) => c.entradas),
        saidas: somar((c) => c.saidas),
        transferenciasEntrada: somar((c) => c.transferenciasEntrada),
        transferenciasSaida: somar((c) => c.transferenciasSaida),
        saldoFinal: fim,
      }
    }
    const grupos = (['CAIXA', 'BANCO'] as const).map((tipo) => {
      const contas = lista.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      return { tipo, contas, totais: totais(contas) }
    })
    const totalDisponivel = totais(grupos.flatMap((g) => g.contas))
    const cartaoAReceber = lista.find((c) => c.tipo === 'CARTAO_A_RECEBER') ?? null
    return {
      modo,
      de,
      ate,
      grupos,
      totalDisponivel,
      cartaoAReceber,
      totalComRecebiveis: reais(centavos(totalDisponivel.saldoFinal) + centavos(cartaoAReceber?.saldoFinal ?? 0)),
    }
  }
}

/** Intervalos de `Agrupamento.intervalos`: semanas de segunda a domingo, cortadas nas pontas. */
function intervalos(p: Periodo, agrupamento: Agrupamento): [string, string][] {
  const lista: [string, string][] = []
  let inicio = p.de
  while (inicio <= p.ate) {
    const [a, m, d] = inicio.split('-').map(Number)
    const data = new Date(a, m - 1, d)
    let fim: string
    if (agrupamento === 'DIA') fim = inicio
    else if (agrupamento === 'SEMANA') fim = paraIsoData(new Date(a, m - 1, d + ((7 - data.getDay()) % 7)))
    else fim = ultimoDiaDoMes(inicio.slice(0, 7))
    if (fim > p.ate) fim = p.ate
    lista.push([inicio, fim])
    inicio = deslocarDia(fim, 1)
  }
  return lista
}

export const bancoRelatorios = new BancoRelatorios()
