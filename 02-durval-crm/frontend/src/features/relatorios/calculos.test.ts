import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoFinanceiro, CARTAO, CONTAS } from '../../mocks/bancoFinanceiro'
import { bancoRelatorios } from '../../mocks/bancoRelatorios'
import { bancoVendas } from '../../mocks/bancoVendas'
import { hoje, paraIsoData } from '../../shared/formatters/datas'
import { fechaEstoque } from './regras'

const tesoureira = USUARIOS_SIMULADOS.find((u) => u.id === 'u-tesoureiro')!
const vendedor = USUARIOS_SIMULADOS.find((u) => u.id === 'u-vendedor')!
const HOJE = paraIsoData(hoje())
const MES = { de: `${HOJE.slice(0, 7)}-01`, ate: HOJE }
const CANTINA = 2
const BANCO_A = 3
const CAFE = 10
const O_CAMINHO = 1

function vender(produtoId: number, quantidade: number, preco: number, meio: 'DINHEIRO' | 'CARTAO') {
  return bancoVendas.confirmar({
    itens: [{ produtoId, quantidade, precoUnitario: preco }],
    pagamentos: [meio === 'CARTAO' ? { meio, valor: quantidade * preco, tipoCartao: 'CREDITO' } : { meio, valor: quantidade * preco }],
    refazVendaId: null,
    chaveIdempotencia: crypto.randomUUID(),
  }, vendedor)
}

/** Um mês de movimento: bazar, vendas (uma cancelada), liquidação de cartão, transferência e despesa. */
function movimentar() {
  // As vendas em dinheiro entram no caixa da cantina.
  bancoFinanceiro.definirContasRecebimento(CANTINA, BANCO_A)
  bancoFinanceiro.lancarManual(tesoureira, { contaId: BANCO_A, data: HOJE, tipo: 'RECEITA', categoria: 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS', valor: 1000, descricao: 'Bazar', anexo: null, chaveIdempotencia: '' })
  vender(CAFE, 2, 3.5, 'DINHEIRO')
  vender(O_CAMINHO, 1, 50, 'CARTAO')
  const cancelada = vender(CAFE, 1, 3.5, 'DINHEIRO')
  bancoVendas.cancelar(cancelada.id, 'Quantidade digitada errada', vendedor)
  bancoFinanceiro.liquidarCartao(tesoureira, { contaBancariaId: BANCO_A, data: HOJE, bruto: 50, taxa: 2, referencia: '', chaveIdempotencia: '' })
  bancoFinanceiro.transferir(tesoureira, { contaOrigemId: CANTINA, contaDestinoId: BANCO_A, valor: 5, data: HOJE, descricao: 'Depósito', chaveIdempotencia: '' })
  bancoFinanceiro.lancarManual(tesoureira, { contaId: BANCO_A, data: HOJE, tipo: 'DESPESA', categoria: 'DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA', valor: 30, descricao: 'Luz', anexo: null, chaveIdempotencia: '' })
}

describe('cálculos simulados dos relatórios (espelho do backend)', () => {
  it('US-REPORT-001: o fluxo de caixa fecha com o saldo das contas', () => {
    movimentar()
    const f = bancoRelatorios.fluxoCaixa({ ...MES, agrupamento: 'SEMANA' })
    // Entradas 1000 + 7 + 50 = 1057; saídas 30 + 2 = 32.
    expect(f.totalEntradas).toBe(1057)
    expect(f.totalSaidas).toBe(32)
    expect(f.transferenciasEntrada).toBe(f.transferenciasSaida)
    const saldos = CONTAS.reduce((s, c) => s + bancoFinanceiro.saldo(c.id), 0)
    expect(f.saldoFinal).toBeCloseTo(saldos, 2)
    expect(f.periodos.at(-1)!.saldoFinal).toBe(f.saldoFinal)

    const cartao = bancoRelatorios.fluxoCaixa({ ...MES, agrupamento: 'MES', contaId: CARTAO.id })
    expect(cartao.totalEntradas).toBe(50)
    expect(cartao.totalSaidas).toBe(2)
    expect(cartao.transferenciasSaida).toBe(48)
    expect(cartao.saldoFinal).toBe(0)
  })

  it('US-REPORT-002 e 003: categorias com participação e saldos por conta', () => {
    movimentar()
    const r = bancoRelatorios.receitasDespesas(MES)
    expect(r.resultado).toBe(1025)
    const vendas = r.receitas.find((g) => g.codigo === 'RECEITAS_VENDAS')!
    expect(vendas.valor).toBe(57)
    expect(vendas.percentual).toBe(5.4)
    // Todo o plano ativo aparece, mesmo sem valor.
    expect(r.despesas.find((g) => g.codigo === 'OUTRAS_DESPESAS')?.valor).toBe(0)

    const s = bancoRelatorios.saldos(MES)
    const banco = s.grupos.find((g) => g.tipo === 'BANCO')!.contas.find((c) => c.contaId === BANCO_A)!
    expect(banco.entradas).toBe(1000)
    expect(banco.saidas).toBe(30)
    expect(banco.transferenciasEntrada).toBe(53)
    expect(banco.saldoFinal).toBe(1023)
    expect(s.cartaoAReceber?.saldoFinal).toBe(0)
    expect(s.totalComRecebiveis).toBe(1025)
    expect(bancoRelatorios.saldos({ data: HOJE }).grupos[0].contas[0].saldoInicial).toBeNull()
  })

  it('US-REPORT-006, 007 e 009: vendas, estoque e acertos com editoras', () => {
    movimentar()
    const v = bancoRelatorios.vendas(vendedor, MES)
    expect(v.vendas).toBe(3)
    expect(v.canceladas).toBe(1)
    expect(v.receitaLiquida).toBe(57)
    expect(v.porProduto[0].nome).toBe('O Caminho')
    expect(v.porMeio.find((m) => m.meio === 'CARTAO_CREDITO')?.valor).toBe(50)
    expect(v.porMeio.find((m) => m.meio === 'CARTAO')).toBeUndefined()

    const e = bancoRelatorios.estoque({ ...MES, tipo: 'CANTINA' })
    const cafe = e.produtos.find((p) => p.produtoId === CAFE)!
    expect(cafe.total.venda).toBe(2)
    expect(e.produtos.every((p) => p.origens.every(fechaEstoque))).toBe(true)
    expect(bancoRelatorios.contagem({ tipo: 'CANTINA' }).itens.find((i) => i.produtoId === CAFE)?.quantidade).toBe(cafe.total.fim)

    const livros = bancoRelatorios.estoque({ ...MES, tipo: 'LIVRO' })
    expect(livros.produtos.find((p) => p.produtoId === O_CAMINHO)?.origens.every((o) => o.origem === 'CONSIGNADO')).toBe(true)

    const a = bancoRelatorios.editoras(MES)
    expect(a.total.obrigacoesVendas).toBe(20)
    expect(a.total.saldoFinal).toBe(a.total.saldoInicial + 20)
  })
})
