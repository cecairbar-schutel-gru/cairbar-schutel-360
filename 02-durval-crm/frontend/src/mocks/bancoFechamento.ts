import type { Usuario } from '../auth'
import type {
  Autor,
  Checklist,
  EventoPeriodo,
  GrupoComparado,
  HistoricoPeriodo,
  ItemChecklist,
  LinhaComparada,
  PainelFechamento,
  PeriodoReaberto,
  ResumoCompetencias,
  ResumoPeriodo,
  SaldoContaMes,
  SituacaoJanela,
  SaldoEditoraMes,
  StatusPeriodo,
  Variacao,
  VersaoDemonstrativo,
  DemonstrativoMensal,
} from '../features/fechamento/types'
import type { PainelTesoureiro } from '../features/financeiro/types'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import { bancoConciliacoes } from './bancoConciliacoes'
import { bancoDoadores } from './bancoDoadores'
import { bancoEditoras } from './bancoEditoras'
import { bancoEstoque } from './bancoEstoque'
import { bancoFinanceiro, CARTAO, CATEGORIA } from './bancoFinanceiro'
import { bancoIntencoes } from './bancoIntencoes'
import { ErroNegocio } from './erroNegocio'
import { travaPeriodo } from './travaPeriodo'

interface Grupo {
  codigo: string
  nome: string
  valor: number
  subcategorias: { codigo: string; nome: string; valor: number }[]
}

/** Conteúdo gravado como versão a cada fechamento (US-CLOSING-007). */
interface Demonstrativo {
  mes: string
  receitas: Grupo[]
  totalReceitas: number
  despesas: Grupo[]
  totalDespesas: number
  resultado: number
  contas: SaldoContaMes[]
  editoras: SaldoEditoraMes[]
  totalEditoras: number
  mensalidades: ResumoCompetencias
  recebidoMensalidades: number
}

interface PeriodoMock {
  mes: string
  status: StatusPeriodo
  fechamento: Autor | null
  nota: string | null
  reabertura: Autor | null
  justificativa: string | null
  cartao: Autor | null
}

interface SnapshotMock {
  mes: string
  versao: number
  autor: Autor
  demonstrativo: Demonstrativo
}

interface JanelaMock {
  diaInicio: number
  diaFim: number
  alteracao: Autor | null
}

/** US-CLOSING-014: sem configuração, do dia 1 ao dia 7; no máximo 7 dias seguidos, até o dia 28. */
const JANELA_PADRAO: JanelaMock = { diaInicio: 1, diaFim: 7, alteracao: null }
const MAXIMO_DIAS_JANELA = 7
const ULTIMO_DIA_JANELA = 28
const MINIMO_JUSTIFICATIVA = 20
const MESES_NA_LISTA = 24
const centavos = (v: number) => Math.round(v * 100)
const reais = (c: number) => c / 100
const soma = (valores: number[]) => reais(valores.reduce((s, v) => s + centavos(v), 0))
const brl = (v: number) => formatarMoeda(v).replace(/ /g, ' ')
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const mesBr = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`
const compactar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ')
const regra = (codigo: string, mensagem: string) => new ErroNegocio(409, codigo, mensagem)
const validacao = (campo: string, mensagem: string) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])

function deslocar(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ultimoDia(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
}

/** Início do mês seguinte no fuso da organização (UTC−3), como o limite do backend. */
function limiteDoMes(mes: string): string {
  return `${deslocar(mes, 1)}-01T03:00:00.000Z`
}

/** Mesma regra do domínio (US-CLOSING-013): mais de 20% e mais de R$ 100,00. */
export function variacao(atual: number, anterior: number): Variacao {
  const diferenca = reais(centavos(atual) - centavos(anterior))
  const percentual = centavos(anterior) === 0 ? null : Math.round((diferenca * 1000) / Math.abs(anterior)) / 10
  const destaque = Math.abs(diferenca) > 100 && (percentual === null || Math.abs(percentual) > 20)
  return { atual, anterior, diferenca, percentual, destaque }
}

function comparar(atual: Grupo[], anterior: Grupo[]): GrupoComparado[] {
  const codigos = [...atual.map((g) => g.codigo), ...anterior.filter((g) => !atual.some((a) => a.codigo === g.codigo)).map((g) => g.codigo)]
  return codigos.map((codigo) => {
    const a = atual.find((g) => g.codigo === codigo)
    const b = anterior.find((g) => g.codigo === codigo)
    const subs: LinhaComparada[] = (a?.subcategorias ?? []).map((l) => ({
      codigo: l.codigo,
      nome: l.nome,
      valores: variacao(l.valor, b?.subcategorias.find((x) => x.codigo === l.codigo)?.valor ?? 0),
    }))
    for (const x of b?.subcategorias ?? []) {
      if (!subs.some((s) => s.codigo === x.codigo)) subs.push({ codigo: x.codigo, nome: x.nome, valores: variacao(0, x.valor) })
    }
    return { codigo, nome: (a ?? b)!.nome, valores: variacao(a?.valor ?? 0, b?.valor ?? 0), subcategorias: subs }
  })
}

/** Espelho simulado do módulo Fechamento mensal do backend (US-CLOSING-001, 007, 008, 009, 013 e 014). */
class BancoFechamento {
  private registros = new Map<string, PeriodoMock>()
  private snapshots: SnapshotMock[] = []
  private eventos: EventoPeriodo[] = []
  private janelaAtual: JanelaMock = JANELA_PADRAO

  reiniciar(): void {
    this.registros = new Map()
    this.snapshots = []
    this.eventos = []
    this.janelaAtual = JANELA_PADRAO
    travaPeriodo.reiniciar()
  }

  // US-CLOSING-014

  janela(): SituacaoJanela {
    const { diaInicio, diaFim, alteracao } = this.janelaAtual
    const hojeIso = paraIsoData(hoje())
    const dia = Number(hojeIso.slice(8, 10))
    const mes = dia > diaFim ? deslocar(hojeIso.slice(0, 7), 1) : hojeIso.slice(0, 7)
    const diaDoMes = (d: number) => `${mes}-${String(d).padStart(2, '0')}`
    return {
      diaInicio,
      diaFim,
      aberta: dia >= diaInicio && dia <= diaFim,
      inicio: diaDoMes(diaInicio),
      fim: diaDoMes(diaFim),
      alteradoPor: alteracao?.nome ?? null,
      alteradoEm: alteracao?.em ?? null,
    }
  }

  alterarJanela(usuario: Usuario, diaInicio: number | undefined, diaFim: number | undefined): SituacaoJanela {
    const valido = (d: number | undefined): d is number => Number.isInteger(d) && d! >= 1 && d! <= ULTIMO_DIA_JANELA
    if (!valido(diaInicio)) throw validacao('diaInicio', `Escolha um dia de 1 a ${ULTIMO_DIA_JANELA}.`)
    if (!valido(diaFim)) throw validacao('diaFim', `Escolha um dia de 1 a ${ULTIMO_DIA_JANELA}.`)
    if (diaFim < diaInicio) throw validacao('diaFim', 'O último dia não pode ser antes do primeiro.')
    if (diaFim - diaInicio + 1 > MAXIMO_DIAS_JANELA) throw validacao('diaFim', `A janela tem no máximo ${MAXIMO_DIAS_JANELA} dias.`)
    this.janelaAtual = { diaInicio, diaFim, alteracao: this.autor(usuario) }
    return this.janela()
  }

  // US-CLOSING-001

  painel(): PainelFechamento {
    const atual = this.mesAtual()
    const aFechar = this.mesAFechar()
    return {
      mesAtual: atual,
      primeiroPeriodo: bancoFinanceiro.primeiroPeriodo(),
      mesAFechar: aFechar,
      checklist: aFechar ? this.checklist(aFechar) : null,
      ultimoFechado: this.ultimoFechado(),
    }
  }

  /** Resumo para o painel do Tesoureiro. */
  situacao(): PainelTesoureiro['periodo'] {
    const p = this.painel()
    if (!p.checklist) return { mes: p.mesAtual, situacao: 'EM_ANDAMENTO', itensConcluidos: null, itensTotal: null }
    return { mes: p.checklist.mes, situacao: p.checklist.status as 'ABERTO' | 'REABERTO', itensConcluidos: p.checklist.concluidos, itensTotal: p.checklist.itens.length }
  }

  checklist(mes: string): Checklist {
    this.exigirFormato(mes)
    const fim = ultimoDia(mes)
    const limite = limiteDoMes(mes)
    const periodo = this.periodo(mes)
    const itens: ItemChecklist[] = []

    const bancos = bancoConciliacoes
      .contas()
      .filter((c) => c.dataCorte <= fim && (!c.conciliadaAte || c.conciliadaAte < fim))
      .map((c) => `${c.contaNome}: ${c.conciliadaAte ? `conciliada até ${dataBr(c.conciliadaAte)}` : 'nunca conciliada'}`)
    itens.push({ codigo: 'CONCILIACAO', titulo: 'Conciliação bancária', concluido: bancos.length === 0, pendentes: bancos.length, responsavel: 'TESOUREIRO', detalhes: bancos, cartao: null })

    const abertas = bancoIntencoes.emAbertoCriadasAntesDe(limite)
    itens.push({
      codigo: 'INTENCOES',
      titulo: 'Intenções de gasto',
      concluido: abertas === 0,
      pendentes: abertas,
      responsavel: 'TESOUREIRO',
      detalhes: abertas === 0 ? [] : [`${abertas} ${abertas === 1 ? 'intenção pendente ou divergente' : 'intenções pendentes ou divergentes'}`],
      cartao: null,
    })

    const pedidos = bancoEstoque.pendentesFeitasAntesDe(limite)
    itens.push({
      codigo: 'ESTOQUE',
      titulo: 'Solicitações de estoque',
      concluido: pedidos === 0,
      pendentes: pedidos,
      responsavel: 'ADMINISTRADOR',
      detalhes: pedidos === 0 ? [] : [`${pedidos} ${pedidos === 1 ? 'pedido aguardando o Administrador' : 'pedidos aguardando o Administrador'}`],
      cartao: null,
    })

    const semAcerto = bancoEditoras
      .fechamento(mes)
      .editoras.filter((e) => e.transferencia === null)
      .map((e) => `${e.nome}: ${brl(e.saldoNoFimDoMes)}`)
    itens.push({ codigo: 'EDITORAS', titulo: 'Editoras', concluido: semAcerto.length === 0, pendentes: semAcerto.length, responsavel: 'TESOUREIRO', detalhes: semAcerto, cartao: null })

    const c = periodo.cartao
    itens.push({
      codigo: 'CARTAO',
      titulo: 'Liquidações de cartão',
      concluido: c !== null,
      pendentes: c ? 0 : 1,
      responsavel: 'TESOUREIRO',
      detalhes: [],
      cartao: {
        saldoNoFimDoMes: bancoFinanceiro.saldo(CARTAO.id, fim),
        ultimaLiquidacao: bancoFinanceiro.ultimaLiquidacaoAte(fim),
        confirmadoPor: c?.nome ?? null,
        confirmadoEm: c?.em ?? null,
      },
    })

    const concluidos = itens.filter((i) => i.concluido).length
    const terminou = mes < this.mesAtual()
    const reaberto = periodo.status === 'REABERTO' ? periodo.reabertura : null
    const janela = this.janela()
    return {
      mes,
      status: periodo.status,
      terminou,
      itens,
      concluidos,
      podeFechar: terminou && periodo.status !== 'FECHADO' && concluidos === itens.length && janela.aberta,
      janela,
      reabertoPor: reaberto?.nome ?? null,
      reabertoEm: reaberto?.em ?? null,
      justificativaReabertura: reaberto ? periodo.justificativa : null,
    }
  }

  confirmarCartao(usuario: Usuario, mes: string): Checklist {
    this.exigirFormato(mes)
    const aFechar = this.mesAFechar()
    if (aFechar !== mes) {
      throw regra('PERIODO_FORA_DE_ORDEM', aFechar ? `A confirmação vale para o mês a fechar (${mesBr(aFechar)}).` : 'Não há mês a fechar.')
    }
    const p = this.registrar(mes)
    const autor = this.autor(usuario)
    p.cartao = autor
    this.eventos.push({ mes, evento: 'CARTAO_CONFIRMADO', autor, texto: null, versao: null })
    return this.checklist(mes)
  }

  // US-CLOSING-008

  fechar(usuario: Usuario, mes: string, nota: string): HistoricoPeriodo {
    this.exigirFormato(mes)
    if (mes >= this.mesAtual()) throw regra('PERIODO_EM_ANDAMENTO', `O mês de ${mesBr(mes)} ainda não terminou e não pode ser fechado.`)
    const aFechar = this.mesAFechar()
    if (aFechar !== mes) {
      throw regra('PERIODO_FORA_DE_ORDEM', aFechar ? `Os meses são fechados em ordem: feche antes ${mesBr(aFechar)}.` : `O mês de ${mesBr(mes)} já está fechado.`)
    }
    const pendentes = this.checklist(mes).itens.filter((i) => !i.concluido).map((i) => i.titulo)
    if (pendentes.length > 0) throw regra('CHECKLIST_PENDENTE', `Ainda há itens pendentes no checklist: ${pendentes.join(', ')}.`)
    const janela = this.janela()
    if (!janela.aberta) {
      throw regra(
        'FORA_DA_JANELA_FECHAMENTO',
        `O fechamento só pode ser feito do dia ${janela.diaInicio} ao dia ${janela.diaFim} de cada mês. Próxima janela: ${dataBr(janela.inicio)} a ${dataBr(janela.fim)}.`,
      )
    }
    const texto = compactar(nota)
    if (texto.length > 1000) throw validacao('nota', 'Use até 1000 caracteres na nota.')
    const p = this.registrar(mes)
    const autor = this.autor(usuario)
    p.status = 'FECHADO'
    p.fechamento = autor
    p.nota = texto || null
    travaPeriodo.fechar(mes)
    const versao = this.snapshots.filter((s) => s.mes === mes).length + 1
    this.snapshots.push({ mes, versao, autor, demonstrativo: this.montar(mes) })
    this.eventos.push({ mes, evento: 'FECHAMENTO', autor, texto: p.nota, versao })
    return this.historico(mes)
  }

  // US-ADMIN-012: meses do histórico importado entram fechados, sem checklist.

  fecharImportados(usuario: Usuario, meses: string[], importacaoId: number): void {
    const autor = this.autor(usuario)
    const texto = `Histórico importado (importação nº ${importacaoId}).`
    for (const mes of [...meses].sort()) {
      const p = this.registrar(mes)
      if (p.status !== 'ABERTO') throw regra('PERIODO_FECHADO', `O mês de ${mesBr(mes)} já está fechado.`)
      p.status = 'FECHADO'
      p.fechamento = autor
      p.nota = texto
      travaPeriodo.fechar(mes)
      const versao = this.snapshots.filter((s) => s.mes === mes).length + 1
      this.snapshots.push({ mes, versao, autor, demonstrativo: this.montar(mes) })
      this.eventos.push({ mes, evento: 'IMPORTACAO', autor, texto, versao })
    }
  }

  importadosIntocados(meses: string[]): boolean {
    return meses.every((mes) => this.periodo(mes).status === 'FECHADO' && this.eventos.filter((e) => e.mes === mes).every((e) => e.evento === 'IMPORTACAO'))
  }

  desfazerImportados(meses: string[]): void {
    for (const mes of meses) {
      this.registros.delete(mes)
      this.snapshots = this.snapshots.filter((s) => s.mes !== mes)
      this.eventos = this.eventos.filter((e) => e.mes !== mes)
      travaPeriodo.abrir(mes)
    }
  }

  // US-CLOSING-009

  reabrir(usuario: Usuario, mes: string, justificativa: string): HistoricoPeriodo {
    this.exigirFormato(mes)
    const ultimo = this.ultimoFechado()
    if (ultimo !== mes) {
      throw regra('REABERTURA_FORA_DE_ORDEM', ultimo ? `Só o mês fechado mais recente (${mesBr(ultimo)}) pode ser reaberto.` : 'Nenhum mês está fechado.')
    }
    const texto = compactar(justificativa)
    if (texto.length < MINIMO_JUSTIFICATIVA || texto.length > 1000) {
      throw validacao('justificativa', `Explique por que o mês precisa ser reaberto (de ${MINIMO_JUSTIFICATIVA} a 1000 caracteres).`)
    }
    const p = this.registrar(mes)
    const autor = this.autor(usuario)
    p.status = 'REABERTO'
    p.reabertura = autor
    p.justificativa = texto
    p.cartao = null
    travaPeriodo.abrir(mes)
    this.eventos.push({ mes, evento: 'REABERTURA', autor, texto, versao: null })
    return this.historico(mes)
  }

  periodos(): ResumoPeriodo[] {
    const painel = this.painel()
    if (!painel.primeiroPeriodo) return []
    const atual = painel.mesAtual
    const limite = deslocar(atual, -(MESES_NA_LISTA - 1))
    const inicio = painel.primeiroPeriodo > limite ? painel.primeiroPeriodo : limite
    const lista: ResumoPeriodo[] = []
    for (let m = atual; m >= inicio; m = deslocar(m, -1)) {
      const p = this.periodo(m)
      lista.push({
        mes: m,
        situacao: m === atual ? 'EM_ANDAMENTO' : p.status,
        fechadoPor: p.fechamento?.nome ?? null,
        fechadoEm: p.fechamento?.em ?? null,
        nota: p.nota,
        reabertoPor: p.reabertura?.nome ?? null,
        reabertoEm: p.reabertura?.em ?? null,
        justificativa: p.justificativa,
        versoes: this.snapshots.filter((s) => s.mes === m).length,
        aFechar: m === painel.mesAFechar,
        podeReabrir: m === painel.ultimoFechado,
      })
    }
    return lista
  }

  historico(mes: string): HistoricoPeriodo {
    this.exigirFormato(mes)
    return { mes, status: this.periodo(mes).status, eventos: this.eventos.filter((e) => e.mes === mes), versoes: this.versoes(mes) }
  }

  reabertos(): PeriodoReaberto[] {
    return [...this.registros.values()]
      .filter((p) => p.status === 'REABERTO')
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .map((p) => ({ mes: p.mes, reabertoPor: p.reabertura!.nome ?? p.reabertura!.subject, reabertoEm: p.reabertura!.em }))
  }

  // US-CLOSING-007 e 013

  demonstrativo(mes: string, versao?: number): DemonstrativoMensal {
    this.exigirFormato(mes)
    if (mes > this.mesAtual()) throw validacao('mes', 'O mês não pode ser futuro.')
    const periodo = this.periodo(mes)
    const versoes = this.versoes(mes)
    let gravado: SnapshotMock | undefined
    if (versao !== undefined) {
      gravado = this.snapshots.find((s) => s.mes === mes && s.versao === versao)
      if (!gravado) throw new ErroNegocio(404, 'VERSAO_NAO_ENCONTRADA', 'Versão do demonstrativo não encontrada.')
    } else if (periodo.status === 'FECHADO') {
      gravado = this.ultima(mes)
    }
    const atual = gravado?.demonstrativo ?? this.montar(mes)
    const mesAnterior = deslocar(mes, -1)
    const anteriorFechado = this.periodo(mesAnterior).status === 'FECHADO'
    const anterior = (anteriorFechado ? this.ultima(mesAnterior)?.demonstrativo : undefined) ?? this.montar(mesAnterior)
    return {
      mes,
      situacao: gravado ? 'FECHADO' : 'PRELIMINAR',
      versao: gravado?.versao ?? null,
      versaoVigente: !gravado || (periodo.status === 'FECHADO' && versoes[0]?.versao === gravado.versao),
      fechamento: gravado?.autor ?? null,
      versoes,
      mesAnterior,
      anteriorFechado,
      receitas: comparar(atual.receitas, anterior.receitas),
      totalReceitas: variacao(atual.totalReceitas, anterior.totalReceitas),
      despesas: comparar(atual.despesas, anterior.despesas),
      totalDespesas: variacao(atual.totalDespesas, anterior.totalDespesas),
      resultado: variacao(atual.resultado, anterior.resultado),
      contas: atual.contas,
      editoras: atual.editoras,
      totalEditoras: atual.totalEditoras,
      mensalidades: atual.mensalidades,
      recebidoMensalidades: atual.recebidoMensalidades,
    }
  }

  // Apoio

  private montar(mes: string): Demonstrativo {
    const { RECEITA: receitas, DESPESA: despesas } = bancoFinanceiro.porCategoria(mes)
    const totalReceitas = soma(receitas.map((g) => g.valor))
    const totalDespesas = soma(despesas.map((g) => g.valor))
    const editoras = bancoEditoras
      .fechamento(mes)
      .editoras.map((e) => ({ editoraId: e.editoraId, nome: e.nome, saldo: e.saldoNoFimDoMes, transferido: e.transferencia !== null }))
    const competencias = bancoDoadores.todasAsCompetencias().filter((c) => c.competencia === mes && c.status !== 'CANCELADA')
    const valor = (status?: string) => soma(competencias.filter((c) => !status || c.status === status).map((c) => c.valor))
    return {
      mes,
      receitas,
      totalReceitas,
      despesas,
      totalDespesas,
      resultado: reais(centavos(totalReceitas) - centavos(totalDespesas)),
      contas: bancoFinanceiro.movimentoPorConta(mes, ultimoDia(mes)),
      editoras,
      totalEditoras: soma(editoras.map((e) => e.saldo)),
      mensalidades: {
        geradas: competencias.length,
        pagas: competencias.filter((c) => c.status === 'PAGA').length,
        pendentes: competencias.filter((c) => c.status === 'PENDENTE').length,
        valorGerado: valor(),
        valorPago: valor('PAGA'),
        valorPendente: valor('PENDENTE'),
      },
      recebidoMensalidades:
        receitas.flatMap((g) => g.subcategorias).find((s) => s.codigo === CATEGORIA.MENSALIDADES)?.valor ?? 0,
    }
  }

  private mesAtual(): string {
    return paraIsoData(hoje()).slice(0, 7)
  }

  private mesAFechar(): string | null {
    const primeiro = bancoFinanceiro.primeiroPeriodo()
    if (!primeiro) return null
    const atual = this.mesAtual()
    for (let m = primeiro; m < atual; m = deslocar(m, 1)) {
      if (this.periodo(m).status !== 'FECHADO') return m
    }
    return null
  }

  /** Os meses antes do primeiro período são histórico importado e não entram no ciclo de fechamento. */
  private ultimoFechado(): string | null {
    const primeiro = bancoFinanceiro.primeiroPeriodo() ?? ''
    const fechados = [...this.registros.values()].filter((p) => p.status === 'FECHADO' && p.mes >= primeiro).map((p) => p.mes).sort()
    return fechados.length > 0 ? fechados[fechados.length - 1] : null
  }

  private periodo(mes: string): PeriodoMock {
    return this.registros.get(mes) ?? { mes, status: 'ABERTO', fechamento: null, nota: null, reabertura: null, justificativa: null, cartao: null }
  }

  private registrar(mes: string): PeriodoMock {
    const p = this.periodo(mes)
    this.registros.set(mes, p)
    return p
  }

  private ultima(mes: string): SnapshotMock | undefined {
    return this.snapshots.filter((s) => s.mes === mes).sort((a, b) => b.versao - a.versao)[0]
  }

  private versoes(mes: string): VersaoDemonstrativo[] {
    return this.snapshots
      .filter((s) => s.mes === mes)
      .sort((a, b) => b.versao - a.versao)
      .map((s) => ({ versao: s.versao, autor: s.autor }))
  }

  private autor(usuario: Usuario): Autor {
    return { subject: usuario.id, nome: usuario.nome, em: hoje().toISOString() }
  }

  private exigirFormato(mes: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? '')) throw validacao('mes', 'Informe o mês no formato AAAA-MM.')
  }
}

export const bancoFechamento = new BancoFechamento()
