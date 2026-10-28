import type { Papel, Usuario } from '../auth'
import type { MeioPagamento } from '../shared/pagamento/regras'
import { erroTipoCartao, rotuloPagamento } from '../shared/pagamento/regras'
import type {
  DetalheVenda,
  FiltroVendas,
  LayoutComprovante,
  LoteVendido,
  NovaVenda,
  OpcoesVenda,
  PainelVendedor,
  ProdutoVendavel,
  ResumoVenda,
  StatusVenda,
  TipoProduto,
  VendaParaRefazer,
  VendaRegistrada,
} from '../features/vendas/types'
import { MINIMO_MOTIVO_CANCELAMENTO, SEM_VALOR_FISCAL } from '../features/vendas/types'
import { formatarDataHora, hoje, paraIsoData } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import { normalizarTexto } from '../shared/text/texto'
import { bancoEstoque, type ProdutoMock } from './bancoEstoque'
import { bancoFinanceiro, CARTAO, CATEGORIA, ORGANIZACAO } from './bancoFinanceiro'
import { OBRIGACOES, estornarObrigacoesDaVenda, registrarObrigacao } from './cadastroEditoras'
import { ErroNegocio } from './erroNegocio'
import { pdfSimples } from './pdfSimples'

interface VendaMock {
  id: number
  numero: number
  vendedorId: string
  vendedorNome: string
  /** Feita pelo perfil PDV da cantina: entra no relatório e no painel de todo Vendedor. */
  pdv: boolean
  confirmadaEm: string
  data: string
  itens: DetalheVenda['itens']
  pagamentos: DetalheVenda['pagamentos']
  total: number
  chave: string
  refazVendaId: number | null
  status: StatusVenda
  canceladaEm: string | null
  canceladaPor: string | null
  motivoCancelamento: string | null
}

const validacao = (campo: string, mensagem: string) =>
  new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const centavos = (v: number) => Math.round(v * 100)
const duasCasas = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6
const brl = (v: number) => formatarMoeda(v).replace(/\u00a0/g, ' ')
const campo = (produtoId: number) => `itens[${produtoId}]`

/** Espelho simulado do módulo Vendas do backend (mesmas regras e mensagens); produtos e lotes vêm do Estoque. */
class BancoVendas {
  private vendas: VendaMock[] = []
  private proximoId = 1

  constructor() {
    this.reiniciar()
  }

  reiniciar(): void {
    this.vendas = []
    this.proximoId = 1
  }

  // Apoio aos testes.
  saldo(produtoId: number): number {
    return bancoEstoque.saldo(produtoId)
  }

  saldoLote(produtoId: number, remessaId: number | null): number {
    return bancoEstoque.saldoLote(produtoId, remessaId)
  }

  alterarPreco(produtoId: number, preco: number): void {
    bancoEstoque.alterarPreco(produtoId, preco)
  }

  listarObrigacoes() {
    return OBRIGACOES.filter((o) => o.origem === 'VENDA').map((o) => ({
      id: o.id,
      vendaId: o.origemId,
      remessaId: o.remessaId,
      produtoId: o.produtoId,
      valor: o.valor,
      status: o.status,
    }))
  }

  private produto(id: number): ProdutoMock {
    return bancoEstoque.produto(id)
  }

  private vendavel(p: ProdutoMock): ProdutoVendavel {
    const { id, tipo, nome, categoria, autor, isbn, preco } = p
    return { id, tipo, nome, categoria, autor, isbn, preco, disponivel: this.saldo(p.id) }
  }

  private obter(id: number): VendaMock {
    const v = this.vendas.find((x) => x.id === id)
    if (!v) throw new ErroNegocio(404, 'VENDA_NAO_ENCONTRADA', 'Venda não encontrada.')
    return v
  }

  private veTodos(usuario: Usuario): boolean {
    return usuario.papeis.includes('tesoureiro') || usuario.papeis.includes('administrador')
  }

  /** Tesoureiro e Administrador veem todas as vendas; o Vendedor, as que ele fez. */
  private exigirAcesso(v: VendaMock, usuario: Usuario): void {
    if (!this.veTodos(usuario) && v.vendedorId !== usuario.id) {
      throw new ErroNegocio(409, 'VENDA_DE_OUTRO_VENDEDOR', 'Esta venda foi feita por outro vendedor.')
    }
  }

  private refeitaDe(id: number): VendaMock | undefined {
    return this.vendas.find((v) => v.refazVendaId === id)
  }

  // US-SALES-005: contas de recebimento definidas pelo Administrador
  opcoes(): OpcoesVenda {
    const { dinheiro, pix, cartao } = bancoFinanceiro.contasRecebimento()
    const conta = (c: { id: number; nome: string } | null) => (c ? { id: c.id, nome: c.nome } : null)
    return { dinheiro: conta(dinheiro), pix: conta(pix), cartaoAReceber: { id: cartao.id, nome: cartao.nome } }
  }

  // US-SALES-002
  buscar(termo: string, tipo: TipoProduto | null): ProdutoVendavel[] {
    const normalizado = normalizarTexto(termo)
    const compacto = termo.replace(/[\s-]/g, '').toUpperCase()
    const isbn = /^(\d{9}[\dX]|\d{13})$/.test(compacto) ? compacto : null
    return bancoEstoque
      .todos()
      .filter((p) => p.ativo && (tipo === null || p.tipo === tipo))
      .filter((p) => normalizarTexto(`${p.nome} ${p.autor ?? ''}`).includes(normalizado) || (isbn !== null && p.isbn === isbn))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 30)
      .map((p) => this.vendavel(p))
  }

  // US-SALES-006
  confirmar(dados: NovaVenda, usuario: Usuario): VendaRegistrada {
    const repetida = this.vendas.find((v) => v.chave === dados.chaveIdempotencia)
    if (repetida) return this.registrada(repetida)

    if (dados.refazVendaId !== null) {
      const original = this.obter(dados.refazVendaId)
      if (original.status !== 'CANCELADA') {
        throw new ErroNegocio(409, 'VENDA_NAO_CANCELADA', 'Só uma venda cancelada pode ser refeita.')
      }
      const refeita = this.refeitaDe(original.id)
      if (refeita) {
        throw new ErroNegocio(409, 'VENDA_JA_REFEITA', `A venda nº ${original.numero} já foi refeita como nº ${refeita.numero}.`)
      }
    }
    if (dados.itens.some((i) => !Number.isInteger(i.quantidade) || i.quantidade <= 0)) {
      throw validacao('itens', 'Informe o produto e uma quantidade positiva em cada item.')
    }

    if (!usuario.papeis.includes('vendedor') && dados.refazVendaId !== null) {
      throw new ErroNegocio(409, 'SO_PDV', 'O perfil PDV não refaz vendas.')
    }
    const inativos = dados.itens.filter((i) => !bancoEstoque.existe(i.produtoId) || !this.produto(i.produtoId).ativo)
    if (inativos.length > 0) {
      throw new ErroNegocio(
        409,
        'PRODUTO_INATIVO',
        'Há produto inativo no carrinho. Remova-o para continuar.',
        inativos.map((i) => ({ campo: campo(i.produtoId), mensagem: 'Produto inativo: não pode ser vendido.' })),
      )
    }
    const precos = dados.itens.filter((i) => centavos(i.precoUnitario) !== centavos(this.produto(i.produtoId).preco))
    if (precos.length > 0) {
      throw new ErroNegocio(
        409,
        'PRECO_ALTERADO',
        'O preço de algum produto mudou. Confira o carrinho antes de confirmar.',
        precos.map((i) => {
          const p = this.produto(i.produtoId)
          return { campo: campo(p.id), mensagem: `O preço de ${p.nome} agora é ${brl(p.preco)}.` }
        }),
      )
    }
    const faltas = dados.itens.filter((i) => i.quantidade > this.saldo(i.produtoId))
    if (faltas.length > 0) {
      throw new ErroNegocio(
        409,
        'ESTOQUE_INSUFICIENTE',
        'Estoque insuficiente para algum item. Nada foi registrado.',
        faltas.map((i) => {
          const saldo = this.saldo(i.produtoId)
          return {
            campo: campo(i.produtoId),
            mensagem: saldo === 0 ? 'Sem estoque.' : `Só ${saldo} ${saldo === 1 ? 'disponível' : 'disponíveis'}.`,
          }
        }),
      )
    }

    if (dados.itens.length === 0) throw validacao('itens', 'Adicione ao menos um produto.')
    if (new Set(dados.itens.map((i) => i.produtoId)).size !== dados.itens.length) {
      throw validacao('itens', 'Cada produto deve aparecer uma única vez no carrinho.')
    }
    const pagamentos = dados.pagamentos.map((p) => {
      const conta = bancoFinanceiro.contaDeRecebimento(p.meio)
      return { meio: p.meio, contaId: conta.id, contaNome: conta.nome, valor: p.valor, tipoCartao: p.tipoCartao ?? null }
    })
    const tipo = erroTipoCartao(pagamentos)
    if (tipo) throw validacao('tipoCartao', tipo)
    if (pagamentos.length === 0) throw validacao('pagamentos', 'Informe ao menos uma forma de pagamento.')
    if (pagamentos.some((p) => p.valor <= 0 || !duasCasas(p.valor))) {
      throw validacao('pagamentos', 'Os valores devem ser positivos, com até duas casas decimais.')
    }
    const total = dados.itens.reduce((s, i) => s + centavos(this.produto(i.produtoId).preco) * i.quantidade, 0)
    const recebido = pagamentos.reduce((s, p) => s + centavos(p.valor), 0)
    if (recebido < total) {
      throw validacao('pagamentos', `Faltam ${brl((total - recebido) / 100)} para fechar o total de ${brl(total / 100)}.`)
    }
    if (recebido > total) {
      throw validacao(
        'pagamentos',
        `Os pagamentos passam o total de ${brl(total / 100)} em ${brl((recebido - total) / 100)}. Registre só o valor da venda; o troco não entra.`,
      )
    }

    const agora = hoje()
    const id = this.proximoId++
    const itens: DetalheVenda['itens'] = dados.itens.map((i) => {
      const p = this.produto(i.produtoId)
      const lotes: LoteVendido[] = []
      for (const { remessa, quantidade: tirar } of bancoEstoque.retirarParaVenda(p.id, i.quantidade, id, usuario)) {
        if (!remessa) {
          lotes.push({ remessaId: null, remessaCodigo: null, quantidade: tirar, repassePercentual: null, obrigacaoId: null, valorObrigacao: null })
          continue
        }
        const obrigacao = registrarObrigacao({ remessa, produtoId: p.id, origem: 'VENDA', origemId: id, origemNumero: id, quantidade: tirar, precoUnitario: p.preco })
        lotes.push({ remessaId: remessa.id, remessaCodigo: remessa.codigo, quantidade: tirar, repassePercentual: obrigacao.repassePercentual, obrigacaoId: obrigacao.id, valorObrigacao: obrigacao.valor })
      }
      return {
        produtoId: p.id,
        produtoNome: p.nome,
        tipo: p.tipo,
        quantidade: i.quantidade,
        precoUnitario: p.preco,
        subtotal: (centavos(p.preco) * i.quantidade) / 100,
        lotes,
      }
    })
    const v: VendaMock = {
      id,
      numero: id,
      vendedorId: usuario.id,
      vendedorNome: usuario.nome,
      pdv: !usuario.papeis.includes('vendedor'),
      confirmadaEm: agora.toISOString(),
      data: paraIsoData(agora),
      itens,
      pagamentos,
      total: total / 100,
      chave: dados.chaveIdempotencia,
      refazVendaId: dados.refazVendaId,
      status: 'CONCLUIDA',
      canceladaEm: null,
      canceladaPor: null,
      motivoCancelamento: null,
    }
    const totalDoTipo = (tipo: string) => v.itens.filter((i) => i.tipo === tipo).reduce((s, i) => s + centavos(i.subtotal), 0) / 100
    bancoFinanceiro.registrar(
      {
        data: v.data,
        origemTipo: 'VENDA',
        origemId: v.id,
        descricao: `Venda nº ${v.numero}`,
        contas: pagamentos.map((p) => ({ contaId: p.contaId, valor: p.valor, tipoCartao: p.tipoCartao })),
        categorias: [
          { categoria: CATEGORIA.VENDAS_LIVROS, valor: totalDoTipo('LIVRO') },
          { categoria: CATEGORIA.VENDAS_CANTINA, valor: totalDoTipo('CANTINA') },
        ],
      },
      usuario,
    )
    this.vendas.push(v)
    return this.registrada(v)
  }

  private registrada(v: VendaMock): VendaRegistrada {
    return { id: v.id, numero: v.numero, total: v.total, status: v.status }
  }

  // US-SALES-011
  listar(filtro: FiltroVendas, usuario: Usuario): ResumoVenda[] {
    const data = paraIsoData(hoje())
    const vendedor = this.veTodos(usuario) ? null : usuario.id
    const de = filtro.de ?? data
    const ate = filtro.ate ?? filtro.de ?? data
    return this.vendas
      .filter((v) => vendedor === null || v.vendedorId === vendedor)
      .filter((v) => filtro.status === undefined || v.status === filtro.status)
      .filter((v) => filtro.pdv === undefined || v.pdv === filtro.pdv)
      .filter((v) => (filtro.numero !== undefined ? v.numero === filtro.numero : v.data >= de && v.data <= ate))
      .sort((a, b) => b.confirmadaEm.localeCompare(a.confirmadaEm) || b.id - a.id)
      .map((v) => ({
        id: v.id,
        numero: v.numero,
        confirmadaEm: v.confirmadaEm,
        vendedorNome: v.vendedorNome,
        total: v.total,
        meios: [...new Set(v.pagamentos.map((p) => p.meio))].sort() as MeioPagamento[],
        status: v.status,
        pdv: v.pdv,
      }))
  }

  // US-SALES-008/011
  detalhe(id: number, usuario: Usuario): DetalheVenda {
    const v = this.obter(id)
    this.exigirAcesso(v, usuario)
    const origem = v.refazVendaId === null ? null : this.obter(v.refazVendaId)
    const refeita = this.refeitaDe(v.id)
    return {
      id: v.id,
      numero: v.numero,
      confirmadaEm: v.confirmadaEm,
      vendedorNome: v.vendedorNome,
      pdv: v.pdv,
      itens: structuredClone(v.itens),
      pagamentos: structuredClone(v.pagamentos),
      total: v.total,
      status: v.status,
      canceladaEm: v.canceladaEm,
      canceladaPor: v.canceladaPor,
      motivoCancelamento: v.motivoCancelamento,
      refazVenda: origem ? { id: origem.id, numero: origem.numero } : null,
      refeitaComo: refeita ? { id: refeita.id, numero: refeita.numero } : null,
      organizacao: { ...ORGANIZACAO },
    }
  }

  pdf(id: number, layout: LayoutComprovante, usuario: Usuario): { conteudo: Uint8Array; nome: string } {
    const v = this.detalhe(id, usuario)
    const linhas = [
      v.organizacao.nome,
      'Comprovante de venda',
      SEM_VALOR_FISCAL,
      `Venda n. ${v.numero}`,
      `Data/hora: ${formatarDataHora(v.confirmadaEm)}`,
      ...v.itens.map((i) => `${i.quantidade} x ${i.produtoNome} (${brl(i.precoUnitario)}): ${brl(i.subtotal)}`),
      `Total: ${brl(v.total)}`,
      ...v.pagamentos.map((p) => `${rotuloPagamento(p)}: ${brl(p.valor)}`),
      `Vendedor: ${v.vendedorNome ?? '-'}`,
      ...(v.status === 'CANCELADA' ? ['CANCELADA'] : []),
    ]
    return {
      conteudo: layout === 'A4' ? pdfSimples(linhas) : pdfSimples(linhas, 227, 60 + linhas.length * 16 + 40),
      nome: `venda-${v.numero}${layout === 'TERMICA' ? '-80mm' : ''}.pdf`,
    }
  }

  /** A mais recente registrada pelo usuário, qualquer que seja a situação (US-SALES-022). */
  private ultimaDe(usuario: Usuario): VendaMock | undefined {
    return this.vendas
      .filter((v) => v.vendedorId === usuario.id)
      .sort((a, b) => b.confirmadaEm.localeCompare(a.confirmadaEm) || b.id - a.id)[0]
  }

  /**
   * Quem cancela (US-SALES-009 e 022): o Administrador, qualquer venda; o Tesoureiro, as do PDV; o
   * Vendedor, as que fez; o PDV, só a própria última (se ela já foi cancelada, a anterior não libera).
   */
  private exigirPodeCancelar(v: VendaMock, usuario: Usuario): void {
    const papel = (p: Papel) => usuario.papeis.includes(p)
    if (papel('administrador') || (papel('tesoureiro') && v.pdv)) return
    const propria = v.vendedorId === usuario.id
    if (papel('vendedor') && propria) return
    if (papel('pdv') && propria && v.pdv) {
      if (this.ultimaDe(usuario)?.id === v.id) return
      throw new ErroNegocio(409, 'NAO_E_ULTIMA_VENDA_PDV', 'No PDV só a última venda registrada por você pode ser cancelada.')
    }
    throw new ErroNegocio(409, 'VENDA_DE_OUTRO_VENDEDOR', 'Esta venda foi feita por outro vendedor.')
  }

  // US-SALES-022
  ultima(usuario: Usuario): DetalheVenda | undefined {
    const v = this.ultimaDe(usuario)
    return v ? this.detalhe(v.id, usuario) : undefined
  }

  // US-SALES-009
  cancelar(id: number, motivo: string, usuario: Usuario): VendaRegistrada {
    const v = this.obter(id)
    this.exigirPodeCancelar(v, usuario)
    if (v.status === 'CANCELADA') throw new ErroNegocio(409, 'VENDA_JA_CANCELADA', 'Esta venda já foi cancelada.')
    if (motivo.trim().length < MINIMO_MOTIVO_CANCELAMENTO) {
      throw validacao('motivo', `Informe o motivo com pelo menos ${MINIMO_MOTIVO_CANCELAMENTO} caracteres.`)
    }
    const cartao = v.pagamentos.filter((p) => p.meio === 'CARTAO').reduce((s, p) => s + p.valor, 0)
    const saldo = bancoFinanceiro.saldo(CARTAO.id)
    if (cartao > 0 && cartao > saldo) {
      throw new ErroNegocio(
        409,
        'CARTAO_JA_LIQUIDADO',
        `A parte em cartão (${brl(cartao)}) é maior que o saldo atual de Cartão a receber (${brl(saldo)}), pois já foi liquidada. Procure o Tesoureiro para fazer a correção.`,
      )
    }
    // Primeiro o estorno: se ele for recusado (ex.: caixa ficaria negativo), nada muda.
    bancoFinanceiro.estornarOrigem('VENDA', v.id, `Estorno da venda nº ${v.numero}`, usuario)
    for (const item of v.itens) {
      for (const l of item.lotes) bancoEstoque.devolverDeVenda(item.produtoId, l.remessaId, l.quantidade, id, usuario)
    }
    estornarObrigacoesDaVenda(id)
    v.status = 'CANCELADA'
    v.canceladaEm = hoje().toISOString()
    v.canceladaPor = usuario.nome
    v.motivoCancelamento = motivo.trim()
    return this.registrada(v)
  }

  // US-SALES-010
  paraRefazer(id: number, usuario: Usuario): VendaParaRefazer {
    const v = this.obter(id)
    this.exigirAcesso(v, usuario)
    if (v.status !== 'CANCELADA') throw new ErroNegocio(409, 'VENDA_NAO_CANCELADA', 'Só uma venda cancelada pode ser refeita.')
    const refeita = this.refeitaDe(id)
    if (refeita) throw new ErroNegocio(409, 'VENDA_JA_REFEITA', `A venda nº ${v.numero} já foi refeita como nº ${refeita.numero}.`)
    return {
      vendaId: v.id,
      numero: v.numero,
      itens: v.itens.map((i) => {
        const p = this.produto(i.produtoId)
        return {
          produtoId: i.produtoId,
          produtoNome: i.produtoNome,
          tipo: i.tipo,
          quantidade: i.quantidade,
          precoAnterior: i.precoUnitario,
          precoAtual: p.preco,
          disponivel: this.saldo(p.id),
          ativo: p.ativo,
        }
      }),
    }
  }

  // US-SALES-021
  painel(usuario: Usuario): PainelVendedor {
    const data = paraIsoData(hoje())
    const doDia = this.vendas.filter((v) => v.data === data && (v.vendedorId === usuario.id || v.pdv))
    const concluidas = doDia.filter((v) => v.status === 'CONCLUIDA')
    const soma = (lista: VendaMock[], meio: MeioPagamento) =>
      lista.flatMap((v) => v.pagamentos).filter((p) => p.meio === meio).reduce((s, p) => s + centavos(p.valor), 0) / 100
    return {
      data,
      quantidade: concluidas.length,
      totalDinheiro: soma(concluidas, 'DINHEIRO'),
      totalPix: soma(concluidas, 'PIX'),
      totalCartao: soma(concluidas, 'CARTAO'),
      cancelamentos: doDia.length - concluidas.length,
    }
  }

  /** Todas as vendas, para o relatório de vendas (US-REPORT-006). */
  todas(): readonly VendaMock[] {
    return this.vendas
  }
}

export const bancoVendas = new BancoVendas()
