import type { Usuario } from '../auth'
import type {
  ContaPagar,
  DadosContaPagar,
  DetalheContaPagar,
  NovoPagamentoConta,
  PagamentoContaPagar,
  Parcela,
  ResultadoPagamentoConta,
  ResumoContaPagar,
  ResumoContasPagar,
  SituacaoContas,
} from '../features/contaspagar/types'
import type { ErroCampo } from '../shared/api/http'
import { formatarData, hoje, paraIsoData } from '../shared/formatters/datas'
import { bancoFinanceiro } from './bancoFinanceiro'
import { ErroNegocio } from './erroNegocio'

interface PagamentoMock extends PagamentoContaPagar {
  contaPagarId: number
  chave: string
}

const DIAS_A_VENCER = 7
const MAXIMO_VENCIMENTOS = 1200

const validacoes = (erros: ErroCampo[]) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
const validacao = (campo: string, mensagem: string) => validacoes([{ campo, mensagem }])
const regra = (codigo: string, mensagem: string) => new ErroNegocio(409, codigo, mensagem)
const naoEncontrada = () => new ErroNegocio(404, 'CONTA_PAGAR_NAO_ENCONTRADA', 'Conta a pagar não encontrada.')
const compactar = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ')
const duasCasas = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6
const hojeIso = () => paraIsoData(hoje())

/** Soma meses a partir do primeiro vencimento; dia 31 vira o último dia dos meses mais curtos. */
function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const alvo = new Date(a, m - 1 + meses, 1)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  return paraIsoData(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(d, ultimo)))
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return paraIsoData(new Date(a, m - 1, d + dias))
}

/** Vencimentos entre `de` e `ate` (inclusive); nenhum se a conta estiver encerrada. */
export function vencimentos(c: ContaPagar, de: string, ate: string): string[] {
  const datas: string[] = []
  if (!c.ativa) return datas
  for (let n = 0; n < MAXIMO_VENCIMENTOS; n++) {
    const v = c.recorrencia === 'ANUAL' ? somarMeses(c.primeiroVencimento, 12 * n) : somarMeses(c.primeiroVencimento, n)
    if (v > ate || (c.fimRecorrencia && v > c.fimRecorrencia)) break
    if (v >= de) datas.push(v)
    if (c.recorrencia === 'UNICA') break
  }
  return datas
}

/** Espelho simulado do módulo Contas a pagar do backend (mesmas regras e mensagens). */
class BancoContasPagar {
  private contas: ContaPagar[] = []
  private pagamentos: PagamentoMock[] = []
  private proximo = { conta: 1, pagamento: 1 }

  constructor() {
    bancoFinanceiro.aoEstornar('CONTA_PAGAR', (id) => this.aoEstornar(id))
  }

  reiniciar(): void {
    this.contas = []
    this.pagamentos = []
    this.proximo = { conta: 1, pagamento: 1 }
  }

  // Cadastro

  listar(situacao: SituacaoContas): ResumoContaPagar[] {
    return [...this.contas]
      .filter((c) => situacao === 'TODAS' || c.ativa)
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR') || a.id - b.id)
      .map((c) => ({
        conta: c,
        categoriaNome: this.nomeCategoria(c.categoria),
        proximoVencimento: this.emAberto(c, 1)[0] ?? null,
        quitada: this.quitada(c),
      }))
  }

  conta(id: number): DetalheContaPagar {
    const c = this.contaMock(id)
    return {
      conta: c,
      categoriaNome: this.nomeCategoria(c.categoria),
      emAberto: this.emAberto(c, 12),
      pagamentos: this.pagamentos
        .filter((p) => p.contaPagarId === id)
        .sort((a, b) => b.vencimento.localeCompare(a.vencimento) || b.id - a.id)
        .map(paraPagamento),
      quitada: this.quitada(c),
    }
  }

  cadastrar(dados: DadosContaPagar): ContaPagar {
    const c = { ...this.validar(dados), id: this.proximo.conta++, ativa: true }
    this.contas.push(c)
    return c
  }

  alterar(id: number, dados: DadosContaPagar): ContaPagar {
    const atual = this.contaMock(id)
    this.exigirAtiva(atual)
    const comPagamentos = this.pagamentos.some((p) => p.contaPagarId === id)
    if (comPagamentos && (dados.recorrencia !== atual.recorrencia || dados.primeiroVencimento !== atual.primeiroVencimento)) {
      throw regra('CONTA_PAGAR_COM_PAGAMENTOS', 'A recorrência e o primeiro vencimento não mudam depois do primeiro pagamento.')
    }
    const validada = this.validar(dados)
    const ultimoPago = this.validos(id).map((p) => p.vencimento).sort().at(-1)
    if (ultimoPago && validada.fimRecorrencia && validada.fimRecorrencia < ultimoPago) {
      throw validacao('fimRecorrencia', `O vencimento de ${formatarData(ultimoPago)} já foi pago: o fim não pode ser anterior.`)
    }
    Object.assign(atual, validada)
    return atual
  }

  encerrar(id: number): ContaPagar {
    const c = this.contaMock(id)
    this.exigirAtiva(c)
    c.ativa = false
    return c
  }

  reativar(id: number): ContaPagar {
    const c = this.contaMock(id)
    if (c.ativa) throw regra('CONTA_PAGAR_JA_ATIVA', 'Esta conta a pagar já está ativa.')
    c.ativa = true
    return c
  }

  excluir(id: number): void {
    this.contaMock(id)
    if (this.pagamentos.some((p) => p.contaPagarId === id)) {
      throw regra('CONTA_PAGAR_COM_PAGAMENTOS', 'Esta conta já tem pagamentos: encerre-a em vez de excluir.')
    }
    this.contas = this.contas.filter((c) => c.id !== id)
  }

  // Agenda

  parcelas(de: string, ate: string, incluirVencidas: boolean): Parcela[] {
    if (!de || !ate) throw validacao('de', 'Informe o período.')
    if (ate < de) throw validacao('ate', 'A data final deve ser igual ou posterior à inicial.')
    if (ate > somarDias(de, 366)) throw validacao('ate', 'Consulte no máximo um ano por vez.')
    const hojeData = hojeIso()
    const parcelas: Parcela[] = []
    for (const c of this.contas) {
      const pagos = new Map(this.validos(c.id).filter((p) => p.vencimento <= ate).map((p) => [p.vencimento, p]))
      const datas = vencimentos(c, incluirVencidas ? c.primeiroVencimento : de, ate)
      for (const v of datas) {
        const p = pagos.get(v)
        if (v < de && (p || v >= hojeData)) continue
        parcelas.push(this.parcela(c, v, p, hojeData))
      }
      for (const p of pagos.values()) {
        if (p.vencimento >= de && !datas.includes(p.vencimento)) parcelas.push(this.parcela(c, p.vencimento, p, hojeData))
      }
    }
    return parcelas.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao) || a.contaPagarId - b.contaPagarId)
  }

  resumo(): ResumoContasPagar {
    const h = hojeIso()
    const abertas = this.parcelas(h, somarDias(h, DIAS_A_VENCER), true).filter((p) => p.situacao !== 'PAGA')
    const vencidas = abertas.filter((p) => p.situacao === 'VENCIDA')
    const aVencer = abertas.filter((p) => p.situacao === 'A_VENCER')
    const soma = (ps: Parcela[]) => Math.round(ps.reduce((s, p) => s + p.valorPrevisto * 100, 0)) / 100
    return { vencidas: vencidas.length, valorVencidas: soma(vencidas), aVencer: aVencer.length, valorAVencer: soma(aVencer), diasAVencer: DIAS_A_VENCER }
  }

  // Pagamento

  pagar(dados: NovoPagamentoConta, usuario: Usuario): ResultadoPagamentoConta {
    const existente = this.pagamentos.find((p) => dados.chaveIdempotencia && p.chave === dados.chaveIdempotencia)
    if (existente) return { id: existente.id, lancamentoId: existente.lancamentoId, avisos: [] }
    if (!dados.contaPagarId) throw validacao('contaPagarId', 'Escolha a conta a pagar.')
    const c = this.contaMock(dados.contaPagarId)
    if (dados.vencimento && this.validos(c.id).some((p) => p.vencimento === dados.vencimento)) {
      throw regra('VENCIMENTO_JA_PAGO', `O vencimento de ${formatarData(dados.vencimento)} já foi pago.`)
    }
    const categoria = bancoFinanceiro.categorias().find((x) => x.codigo === c.categoria)
    if (!categoria?.ativa) {
      throw regra('CATEGORIA_INATIVA', 'A categoria desta conta foi inativada: escolha outra no cadastro da conta antes de pagar.')
    }
    this.exigirAtiva(c)
    const erros: ErroCampo[] = []
    if (!dados.vencimento) erros.push({ campo: 'vencimento', mensagem: 'Escolha o vencimento.' })
    else if (!vencimentos(c, dados.vencimento, dados.vencimento).includes(dados.vencimento)) {
      erros.push({ campo: 'vencimento', mensagem: `Esta conta não vence em ${formatarData(dados.vencimento)}.` })
    }
    if (!dados.pagoEm) erros.push({ campo: 'pagoEm', mensagem: 'Informe a data do pagamento.' })
    else if (dados.pagoEm > hojeIso()) erros.push({ campo: 'pagoEm', mensagem: 'A data do pagamento não pode ser futura.' })
    if (!(dados.valor > 0)) erros.push({ campo: 'valor', mensagem: 'Informe um valor maior que zero.' })
    else if (!duasCasas(dados.valor)) erros.push({ campo: 'valor', mensagem: 'Use no máximo duas casas decimais.' })
    const origem = bancoFinanceiro.contas().find((x) => x.id === dados.contaId)
    if (!origem) erros.push({ campo: 'contaId', mensagem: 'Escolha a conta de onde sai o pagamento.' })
    else if (origem.tipo === 'CARTAO_A_RECEBER') erros.push({ campo: 'contaId', mensagem: 'Escolha um caixa ou uma conta bancária.' })
    const observacao = compactar(dados.observacao)
    if (observacao.length > 500) erros.push({ campo: 'observacao', mensagem: 'Use até 500 caracteres.' })
    if (erros.length > 0) throw validacoes(erros)
    const id = this.proximo.pagamento
    // Primeiro a despesa: se ela for recusada (ex.: caixa ficaria negativo), nada muda.
    const descricao = `${c.descricao} (vencimento ${formatarData(dados.vencimento)})`
    const despesa = bancoFinanceiro.lancarDespesa(
      {
        data: dados.pagoEm,
        origemTipo: 'CONTA_PAGAR',
        origemId: id,
        descricao: descricao.length <= 200 ? descricao : `${descricao.slice(0, 199)}…`,
        contas: [{ contaId: origem!.id, valor: -dados.valor }],
        categorias: [{ categoria: c.categoria, valor: -dados.valor }],
      },
      usuario,
    )
    this.proximo.pagamento++
    this.pagamentos.push({
      id,
      contaPagarId: c.id,
      vencimento: dados.vencimento,
      pagoEm: dados.pagoEm,
      valor: dados.valor,
      contaId: origem!.id,
      contaNome: origem!.nome,
      observacao: observacao || null,
      lancamentoId: despesa.id,
      registradoPor: usuario.nome,
      registradoEm: hoje().toISOString(),
      estornadoEm: null,
      chave: dados.chaveIdempotencia,
    })
    // Conta única paga: sem mais nada a pagar, fica quitada (inativa).
    if (c.recorrencia === 'UNICA') c.ativa = false
    return { id, lancamentoId: despesa.id, avisos: despesa.avisos }
  }

  /**
   * Equivale ao `EstornoNaOrigemPort` do backend: o vencimento volta a ficar em aberto e a conta única
   * quitada é reativada.
   */
  aoEstornar(pagamentoId: number): void {
    const p = this.pagamentos.find((x) => x.id === pagamentoId)
    if (!p || p.estornadoEm) return
    p.estornadoEm = hoje().toISOString()
    const c = this.contas.find((x) => x.id === p.contaPagarId)
    if (c && c.recorrencia === 'UNICA') c.ativa = true
  }

  /** Única, inativa e com o vencimento pago. */
  private quitada(c: ContaPagar): boolean {
    return c.recorrencia === 'UNICA' && !c.ativa && this.validos(c.id).length > 0
  }

  private parcela(c: ContaPagar, vencimento: string, p: PagamentoMock | undefined, hojeData: string): Parcela {
    return {
      contaPagarId: c.id,
      descricao: c.descricao,
      favorecido: c.favorecido,
      categoria: c.categoria,
      categoriaNome: this.nomeCategoria(c.categoria),
      recorrencia: c.recorrencia,
      vencimento,
      valorPrevisto: c.valorPrevisto,
      contaFinanceiraId: c.contaFinanceiraId,
      situacao: p ? 'PAGA' : vencimento < hojeData ? 'VENCIDA' : 'A_VENCER',
      pagamento: p ? paraPagamento(p) : null,
    }
  }

  private emAberto(c: ContaPagar, limite: number): string[] {
    const h = hojeIso()
    let ate = somarMeses(h, c.recorrencia === 'ANUAL' ? 12 * limite : limite)
    if (ate < c.primeiroVencimento) ate = c.primeiroVencimento
    const pagos = new Set(this.validos(c.id).map((p) => p.vencimento))
    return vencimentos(c, c.primeiroVencimento, ate).filter((v) => !pagos.has(v)).slice(0, limite)
  }

  private validos(contaPagarId: number): PagamentoMock[] {
    return this.pagamentos.filter((p) => p.contaPagarId === contaPagarId && !p.estornadoEm)
  }

  private validar(dados: DadosContaPagar): Omit<ContaPagar, 'id' | 'ativa'> {
    const erros: ErroCampo[] = []
    const descricao = compactar(dados.descricao)
    if (!descricao || descricao.length > 200) erros.push({ campo: 'descricao', mensagem: 'Descreva a conta (até 200 caracteres).' })
    const favorecido = compactar(dados.favorecido)
    if (favorecido.length > 200) erros.push({ campo: 'favorecido', mensagem: 'Use até 200 caracteres.' })
    const categoria = bancoFinanceiro.categorias().find((c) => c.codigo === dados.categoria)
    if (!categoria || !categoria.categoriaPai || !categoria.ativa || categoria.tipo !== 'DESPESA' || !categoria.permiteManual) {
      erros.push({ campo: 'categoria', mensagem: 'Escolha uma subcategoria ativa de despesa.' })
    }
    if (!(dados.valorPrevisto > 0)) erros.push({ campo: 'valorPrevisto', mensagem: 'Informe um valor maior que zero.' })
    else if (!duasCasas(dados.valorPrevisto)) erros.push({ campo: 'valorPrevisto', mensagem: 'Use no máximo duas casas decimais.' })
    if (!dados.recorrencia) erros.push({ campo: 'recorrencia', mensagem: 'Escolha a recorrência.' })
    if (!dados.primeiroVencimento) erros.push({ campo: 'primeiroVencimento', mensagem: 'Informe o vencimento.' })
    const fim = dados.recorrencia === 'UNICA' ? null : dados.fimRecorrencia || null
    if (fim && dados.primeiroVencimento && fim < dados.primeiroVencimento) {
      erros.push({ campo: 'fimRecorrencia', mensagem: 'O fim deve ser igual ou posterior ao primeiro vencimento.' })
    }
    const observacoes = compactar(dados.observacoes)
    if (observacoes.length > 1000) erros.push({ campo: 'observacoes', mensagem: 'Use até 1000 caracteres.' })
    if (dados.contaFinanceiraId) {
      const conta = bancoFinanceiro.contas().find((c) => c.id === dados.contaFinanceiraId)
      if (!conta || !conta.ativa || conta.tipo === 'CARTAO_A_RECEBER') {
        erros.push({ campo: 'contaFinanceiraId', mensagem: 'Escolha um caixa ou uma conta bancária ativa.' })
      }
    }
    if (erros.length > 0) throw validacoes(erros)
    return {
      descricao,
      favorecido: favorecido || null,
      categoria: dados.categoria,
      valorPrevisto: dados.valorPrevisto,
      recorrencia: dados.recorrencia,
      primeiroVencimento: dados.primeiroVencimento,
      fimRecorrencia: fim,
      contaFinanceiraId: dados.contaFinanceiraId || null,
      observacoes: observacoes || null,
    }
  }

  private exigirAtiva(c: ContaPagar): void {
    if (!c.ativa) {
      throw regra('CONTA_PAGAR_ENCERRADA', `A conta a pagar "${c.descricao}" está encerrada. Reative-a para alterar ou pagar.`)
    }
  }

  private nomeCategoria(codigo: string): string | null {
    return bancoFinanceiro.categorias().find((c) => c.codigo === codigo)?.nomeCompleto ?? null
  }

  private contaMock(id: number): ContaPagar {
    const c = this.contas.find((x) => x.id === id)
    if (!c) throw naoEncontrada()
    return c
  }
}

function paraPagamento(p: PagamentoMock): PagamentoContaPagar {
  return {
    id: p.id,
    vencimento: p.vencimento,
    pagoEm: p.pagoEm,
    valor: p.valor,
    contaId: p.contaId,
    contaNome: p.contaNome,
    observacao: p.observacao,
    lancamentoId: p.lancamentoId,
    registradoPor: p.registradoPor,
    registradoEm: p.registradoEm,
    estornadoEm: p.estornadoEm,
  }
}

export const bancoContasPagar = new BancoContasPagar()
