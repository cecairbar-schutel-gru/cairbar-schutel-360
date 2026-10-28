import type { Usuario } from '../auth'
import { percentualValido, validarCnpj } from '../features/editoras/regras'
import type {
  Apuracao,
  DadosEditora,
  DetalheEditora,
  DetalhePedido,
  DetalheRemessa,
  Devolucao,
  Editora,
  EstoqueRemessa,
  FechamentoEditoras,
  ItemRemessaDetalhado,
  LinhaAlocacao,
  LinhaObrigacao,
  LinhaPagamento,
  MeioPagamentoEditora,
  NovaDevolucao,
  NovaRemessa,
  NovoPagamento,
  NovoPedido,
  PreviaPagamento,
  QuadroSaldos,
  ReciboPagamento,
  ResultadoPagamento,
  ResultadoRemessa,
  ResumoEditora,
  ResumoPedido,
  ResumoRemessa,
  SaldoDetalhado,
  SituacaoEditoras,
  SituacaoPedido,
  SituacaoRemessa,
  TituloConsignado,
  TransferenciaSaldo,
} from '../features/editoras/types'
import type { ErroCampo } from '../shared/api/http'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { apenasDigitos, formatarMoeda } from '../shared/formatters/formatadores'
import { validarEmail } from '../shared/validators/validadores'
import { bancoEstoque } from './bancoEstoque'
import { bancoFinanceiro, CATEGORIA, ORGANIZACAO } from './bancoFinanceiro'
import {
  CREDITOS,
  EDITORAS,
  OBRIGACOES,
  REMESSAS,
  reiniciarCadastroEditoras,
  type EditoraMock,
  type ObrigacaoMock,
  type RemessaMock,
} from './cadastroEditoras'
import { ErroNegocio } from './erroNegocio'
import { travaPeriodo } from './travaPeriodo'

interface PagamentoMock {
  id: number
  editoraId: number
  pagoEm: string
  /** Centavos. */
  valor: number
  creditoAplicado: number
  contaId: number
  contaNome: string
  meio: MeioPagamentoEditora
  observacao: string | null
  lancamentoId: number | null
  chave: string
  registradoEm: string
  registradoPor: string
  estornadoEm: string | null
  alocacoes: { obrigacaoId: number; valor: number }[]
}

interface PedidoMock {
  id: number
  editoraId: number
  status: SituacaoPedido
  observacao: string | null
  pedidoEm: string
  pedidoPor: string
  itens: { produtoId: number; quantidade: number }[]
  remessaId: number | null
  canceladoEm: string | null
  canceladoPor: string | null
  motivoCancelamento: string | null
}

interface DevolucaoMock {
  id: number
  remessaId: number
  devolvidaEm: string
  observacao: string | null
  itens: { produtoId: number; quantidade: number }[]
  registradaEm: string
  registradaPor: string
}

const validacoes = (erros: ErroCampo[]) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
const validacao = (campo: string, mensagem: string) => validacoes([{ campo, mensagem }])
const regra = (codigo: string, mensagem: string) => new ErroNegocio(409, codigo, mensagem)
const centavos = (v: number) => Math.round(v * 100)
const reais = (c: number) => c / 100
const brl = (c: number) => formatarMoeda(reais(c)).replace(/ /g, ' ')
const compactar = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ')
const opcional = (v: string | null | undefined) => compactar(v) || null
const dia = (iso: string | null) => (iso ? paraIsoData(new Date(iso)) : null)
const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return paraIsoData(new Date(a, m, 0))
}
const soma = (valores: number[]) => valores.reduce((s, v) => s + v, 0)
const EM_ABERTO = new Set(['ABERTA', 'PARCIALMENTE_PAGA'])

/** Espelho simulado do módulo Editoras do backend (mesmas regras e mensagens). */
class BancoEditoras {
  private pagamentos: PagamentoMock[] = []
  private devolucoes: DevolucaoMock[] = []
  private pedidosMock: PedidoMock[] = []
  private transferencias: TransferenciaSaldo[] = []
  private sequencias = new Map<number, number>()
  private proximo = { pagamento: 1, devolucao: 1, transferencia: 1, pedido: 1 }

  constructor() {
    bancoFinanceiro.aoEstornar('PAGAMENTO_EDITORA', (id) => this.aoEstornar(id))
  }

  reiniciar(): void {
    reiniciarCadastroEditoras()
    this.pagamentos = []
    this.devolucoes = []
    this.pedidosMock = []
    this.transferencias = []
    this.sequencias = new Map()
    this.proximo = { pagamento: 1, devolucao: 1, transferencia: 1, pedido: 1 }
  }

  // US-PUBLISHER-001

  listar(situacao: SituacaoEditoras): ResumoEditora[] {
    const hojeIso = paraIsoData(hoje())
    return EDITORAS.filter((e) => situacao === 'TODAS' || e.ativa === (situacao === 'ATIVAS'))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        cnpj: e.cnpj,
        contatoNome: e.contatoNome,
        telefone: e.telefone,
        ativa: e.ativa,
        remessasAbertas: this.remessas({ editoraId: e.id, situacao: 'ABERTA' }).length,
        saldoDevido: reais(this.saldoEm(e.id, hojeIso)),
      }))
  }

  detalhe(id: number): DetalheEditora {
    const e = this.editoraMock(id)
    const ultimo = this.pagamentos
      .filter((p) => p.editoraId === id && p.estornadoEm === null)
      .sort((a, b) => b.pagoEm.localeCompare(a.pagoEm) || b.id - a.id)[0]
    return {
      editora: { ...e },
      possuiRemessas: REMESSAS.some((r) => r.editoraId === id),
      saldoDevido: reais(this.saldoEm(id, paraIsoData(hoje()))),
      ultimoPagamento: ultimo ? { data: ultimo.pagoEm, valor: reais(ultimo.valor) } : null,
      remessasAbertas: this.remessas({ editoraId: id, situacao: 'ABERTA' }),
    }
  }

  cadastrar(dados: DadosEditora): Editora {
    const e: EditoraMock = { id: Math.max(0, ...EDITORAS.map((x) => x.id)) + 1, ...this.validar(dados, null), ativa: true }
    EDITORAS.push(e)
    return { ...e }
  }

  alterar(id: number, dados: DadosEditora): Editora {
    const e = this.editoraMock(id)
    Object.assign(e, this.validar(dados, id))
    return { ...e }
  }

  inativar(id: number): Editora {
    const e = this.editoraMock(id)
    if (!e.ativa) throw regra('EDITORA_JA_INATIVA', 'Esta editora já está inativa.')
    e.ativa = false
    return { ...e }
  }

  reativar(id: number): Editora {
    const e = this.editoraMock(id)
    if (e.ativa) throw regra('EDITORA_JA_ATIVA', 'Esta editora já está ativa.')
    e.ativa = true
    return { ...e }
  }

  excluir(id: number): void {
    this.editoraMock(id)
    if (REMESSAS.some((r) => r.editoraId === id)) {
      throw regra('EDITORA_COM_REMESSAS', 'A editora já tem remessas e não pode ser excluída. Inative-a.')
    }
    if (bancoEstoque.livrosDaEditora(id).length > 0) {
      throw regra('EDITORA_COM_TITULOS', 'Há títulos do catálogo ligados a esta editora. Inative-a ou mude a editora dos títulos.')
    }
    EDITORAS.splice(EDITORAS.findIndex((e) => e.id === id), 1)
  }

  titulos(editoraId: number): TituloConsignado[] {
    this.editoraMock(editoraId)
    return bancoEstoque
      .livrosDaEditora(editoraId)
      .map((p) => ({ produtoId: p.id, nome: p.nome, autor: p.autor, isbn: p.isbn, editoraId: p.editoraId, repassePadrao: p.repassePadrao, ativo: p.ativo }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  // US-PUBLISHER-003

  remessas(filtro: { editoraId?: number; situacao?: SituacaoRemessa }): ResumoRemessa[] {
    return REMESSAS.filter((r) => filtro.editoraId === undefined || r.editoraId === filtro.editoraId)
      .map((r) => this.resumoRemessa(r))
      .filter((r) => filtro.situacao === undefined || r.situacao === filtro.situacao)
      .sort((a, b) => b.recebidaEm.localeCompare(a.recebidaEm) || b.codigo.localeCompare(a.codigo))
  }

  registrarRemessa(dados: NovaRemessa, usuario: Usuario): ResultadoRemessa {
    if (!dados.editoraId) throw validacao('editoraId', 'Escolha a editora.')
    const e = EDITORAS.find((x) => x.id === dados.editoraId)
    if (!e) throw validacao('editoraId', 'Editora não encontrada.')
    if (!e.ativa) throw regra('EDITORA_INATIVA', `A editora ${e.nome} está inativa e não pode receber novas remessas.`)
    travaPeriodo.exigirAberto(dados.recebidaEm)
    const erros: ErroCampo[] = []
    const hojeIso = paraIsoData(hoje())
    if (!dados.recebidaEm) erros.push({ campo: 'recebidaEm', mensagem: 'Informe a data de recebimento.' })
    else if (dados.recebidaEm > hojeIso) erros.push({ campo: 'recebidaEm', mensagem: 'A data de recebimento não pode ser futura.' })
    const documento = compactar(dados.numeroDocumento)
    if (documento.length > 60) erros.push({ campo: 'numeroDocumento', mensagem: 'Use até 60 caracteres.' })
    const titulos = new Map(this.titulos(e.id).map((t) => [t.produtoId, t]))
    const itens: RemessaMock['itens'] = []
    const vistos = new Set<number>()
    if (!dados.itens?.length) erros.push({ campo: 'itens', mensagem: 'Inclua ao menos um título.' })
    for (const i of dados.itens ?? []) {
      const campo = `itens[${i.produtoId}]`
      const t = titulos.get(i.produtoId)
      if (!t) {
        erros.push({ campo, mensagem: `O título não é da editora ${e.nome}.` })
        continue
      }
      if (vistos.has(i.produtoId)) {
        erros.push({ campo, mensagem: `${t.nome} aparece mais de uma vez.` })
        continue
      }
      vistos.add(i.produtoId)
      if (!t.ativo) {
        erros.push({ campo, mensagem: `${t.nome} está inativo.` })
        continue
      }
      if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) {
        erros.push({ campo, mensagem: `Informe a quantidade de ${t.nome} (maior que zero).` })
        continue
      }
      const percentual = i.repassePercentual ?? t.repassePadrao
      if (percentual === null) {
        erros.push({ campo, mensagem: `Informe o percentual de repasse de ${t.nome}.` })
        continue
      }
      if (!percentualValido(percentual)) {
        erros.push({ campo, mensagem: 'O percentual de repasse vai de 0 a 100, com até duas casas.' })
        continue
      }
      itens.push({ produtoId: i.produtoId, quantidade: i.quantidade, repasse: percentual })
    }
    if (erros.length > 0) throw validacoes(erros)
    const pedido = dados.pedidoId ? this.pedidosMock.find((x) => x.id === dados.pedidoId) : undefined
    if (dados.pedidoId && !pedido) throw validacao('pedidoId', 'Pedido de livros não encontrado.')
    if (pedido) {
      this.exigirPedidoAberto(pedido)
      if (pedido.editoraId !== e.id) throw validacao('pedidoId', 'O pedido é de outra editora.')
    }
    const ano = Number(dados.recebidaEm.slice(0, 4))
    const numero = (this.sequencias.get(ano) ?? 0) + 1
    this.sequencias.set(ano, numero)
    const r: RemessaMock = {
      id: Math.max(0, ...REMESSAS.map((x) => x.id)) + 1,
      codigo: `R-${ano}-${String(numero).padStart(4, '0')}`,
      editoraId: e.id,
      recebidaEm: dados.recebidaEm,
      numeroDocumento: documento || null,
      status: 'ABERTA',
      itens,
      repasse: Object.fromEntries(itens.map((i) => [i.produtoId, i.repasse])),
      registradaEm: hoje().toISOString(),
      registradaPor: usuario.nome,
      canceladaEm: null,
      canceladaPor: null,
      motivoCancelamento: null,
    }
    REMESSAS.push(r)
    for (const i of itens) bancoEstoque.entrarRemessa(i.produtoId, r.id, i.quantidade, usuario)
    if (pedido) Object.assign(pedido, { status: 'RECEBIDO', remessaId: r.id })
    return { id: r.id, codigo: r.codigo }
  }

  remessa(id: number): DetalheRemessa {
    const r = this.remessaMock(id)
    const movimentos = bancoEstoque.movimentosDeRemessas().filter((m) => m.remessaId === id)
    const itens: ItemRemessaDetalhado[] = r.itens
      .map((i) => {
        const p = bancoEstoque.produto(i.produtoId)
        const doItem = movimentos.filter((m) => m.produtoId === i.produtoId)
        const somar = (filtro: (tipo: string) => boolean) => soma(doItem.filter((m) => filtro(m.tipo)).map((m) => m.quantidade))
        return {
          produtoId: i.produtoId,
          titulo: p.nome,
          autor: p.autor,
          isbn: p.isbn,
          recebida: i.quantidade,
          repassePercentual: i.repasse,
          vendida: -somar((t) => t === 'VENDA' || t === 'CANCELAMENTO_VENDA'),
          devolvida: -somar((t) => t === 'DEVOLUCAO_EDITORA'),
          baixada: -somar((t) => t.startsWith('BAIXA_')),
          ajustes: somar((t) => t === 'AJUSTE'),
          restante: bancoEstoque.saldoLote(i.produtoId, id),
          obrigacoes: reais(soma(OBRIGACOES.filter((o) => o.remessaId === id && o.produtoId === i.produtoId && o.status !== 'ESTORNADA').map((o) => centavos(o.valor)))),
        }
      })
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    const situacao = this.situacao(r)
    return {
      id: r.id,
      codigo: r.codigo,
      editoraId: r.editoraId,
      editoraNome: this.editoraMock(r.editoraId).nome,
      recebidaEm: r.recebidaEm,
      numeroDocumento: r.numeroDocumento,
      situacao,
      registradaEm: r.registradaEm,
      registradaPor: r.registradaPor,
      canceladaEm: r.canceladaEm,
      canceladaPor: r.canceladaPor,
      motivoCancelamento: r.motivoCancelamento,
      itens,
      devolucoes: this.devolucoes.filter((d) => d.remessaId === id).map((d) => this.paraDevolucao(d)),
      podeCancelar: r.status !== 'CANCELADA' && movimentos.every((m) => m.tipo === 'ENTRADA_REMESSA'),
      podeDevolver: situacao === 'ABERTA',
    }
  }

  cancelarRemessa(id: number, motivo: string, usuario: Usuario): ResultadoRemessa {
    const r = this.remessaMock(id)
    if (r.status === 'CANCELADA') throw regra('REMESSA_CANCELADA', 'Esta remessa já foi cancelada.')
    if (bancoEstoque.movimentosDeRemessas().some((m) => m.remessaId === id && m.tipo !== 'ENTRADA_REMESSA')) {
      throw regra(
        'REMESSA_COM_MOVIMENTOS',
        'Unidades desta remessa já foram vendidas, devolvidas, baixadas ou ajustadas (ou há baixa pendente). Ela não pode mais ser cancelada.',
      )
    }
    const texto = compactar(motivo)
    if (!texto) throw validacao('motivo', 'Informe o motivo do cancelamento.')
    if (texto.length > 500) throw validacao('motivo', 'Use até 500 caracteres.')
    bancoEstoque.cancelarEntradaRemessa(id, usuario)
    Object.assign(r, { status: 'CANCELADA', canceladaEm: hoje().toISOString(), canceladaPor: usuario.nome, motivoCancelamento: texto })
    // O pedido atendido por esta remessa volta a esperar a entrega correta.
    const pedido = this.pedidosMock.find((x) => x.remessaId === id && x.status === 'RECEBIDO')
    if (pedido) Object.assign(pedido, { status: 'ABERTO', remessaId: null })
    return { id: r.id, codigo: r.codigo }
  }

  // Pedidos de livros (Tesouraria)

  pedidos(filtro: { editoraId?: number; situacao?: SituacaoPedido }): ResumoPedido[] {
    return this.pedidosMock
      .filter((p) => (filtro.editoraId === undefined || p.editoraId === filtro.editoraId) && (!filtro.situacao || p.status === filtro.situacao))
      .sort((a, b) => b.pedidoEm.localeCompare(a.pedidoEm) || b.id - a.id)
      .map((p) => ({
        id: p.id,
        editoraId: p.editoraId,
        editoraNome: this.editoraMock(p.editoraId).nome,
        status: p.status,
        pedidoEm: p.pedidoEm,
        pedidoPor: p.pedidoPor,
        titulos: p.itens.length,
        unidades: soma(p.itens.map((i) => i.quantidade)),
        remessaId: p.remessaId,
        remessaCodigo: p.remessaId ? this.remessaMock(p.remessaId).codigo : null,
      }))
  }

  pedido(id: number): DetalhePedido {
    const p = this.pedidosMock.find((x) => x.id === id)
    if (!p) throw new ErroNegocio(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido de livros não encontrado.')
    const r = p.remessaId ? this.remessaMock(p.remessaId) : null
    const recebidas = new Map((r?.itens ?? []).map((i) => [i.produtoId, i.quantidade]))
    const pedidas = new Map(p.itens.map((i) => [i.produtoId, i.quantidade]))
    const ids = [...new Set([...pedidas.keys(), ...recebidas.keys()])]
    return {
      id: p.id,
      editoraId: p.editoraId,
      editoraNome: this.editoraMock(p.editoraId).nome,
      status: p.status,
      observacao: p.observacao,
      pedidoEm: p.pedidoEm,
      pedidoPor: p.pedidoPor,
      remessaId: p.remessaId,
      remessaCodigo: r?.codigo ?? null,
      canceladoEm: p.canceladoEm,
      canceladoPor: p.canceladoPor,
      motivoCancelamento: p.motivoCancelamento,
      itens: ids.map((produtoId) => {
        const t = bancoEstoque.produto(produtoId)
        return {
          produtoId,
          titulo: t.nome,
          autor: t.autor,
          isbn: t.isbn,
          pedida: pedidas.get(produtoId) ?? 0,
          recebida: r ? (recebidas.get(produtoId) ?? 0) : null,
        }
      }),
    }
  }

  pedir(dados: NovoPedido, usuario: Usuario): DetalhePedido {
    if (!dados.editoraId) throw validacao('editoraId', 'Escolha a editora.')
    const e = EDITORAS.find((x) => x.id === dados.editoraId)
    if (!e) throw validacao('editoraId', 'Editora não encontrada.')
    if (!e.ativa) throw regra('EDITORA_INATIVA', `A editora ${e.nome} está inativa e não pode receber novas remessas.`)
    const erros: ErroCampo[] = []
    const observacao = compactar(dados.observacao)
    if (observacao.length > 500) erros.push({ campo: 'observacao', mensagem: 'Use até 500 caracteres.' })
    const titulos = new Map(this.titulos(e.id).map((t) => [t.produtoId, t]))
    const itens: PedidoMock['itens'] = []
    const vistos = new Set<number>()
    if (!dados.itens?.length) erros.push({ campo: 'itens', mensagem: 'Inclua ao menos um título.' })
    for (const i of dados.itens ?? []) {
      const campo = `itens[${i.produtoId}]`
      const t = titulos.get(i.produtoId)
      if (!t) {
        erros.push({ campo, mensagem: `O título não é da editora ${e.nome}.` })
        continue
      }
      if (vistos.has(i.produtoId)) {
        erros.push({ campo, mensagem: `${t.nome} aparece mais de uma vez.` })
        continue
      }
      vistos.add(i.produtoId)
      if (!t.ativo) {
        erros.push({ campo, mensagem: `${t.nome} está inativo.` })
        continue
      }
      if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) {
        erros.push({ campo, mensagem: `Informe a quantidade de ${t.nome} (maior que zero).` })
        continue
      }
      itens.push({ produtoId: i.produtoId, quantidade: i.quantidade })
    }
    if (erros.length > 0) throw validacoes(erros)
    const p: PedidoMock = {
      id: this.proximo.pedido++,
      editoraId: e.id,
      status: 'ABERTO',
      observacao: observacao || null,
      pedidoEm: hoje().toISOString(),
      pedidoPor: usuario.nome,
      itens,
      remessaId: null,
      canceladoEm: null,
      canceladoPor: null,
      motivoCancelamento: null,
    }
    this.pedidosMock.push(p)
    return this.pedido(p.id)
  }

  cancelarPedido(id: number, motivo: string, usuario: Usuario): DetalhePedido {
    const p = this.pedidosMock.find((x) => x.id === id)
    if (!p) throw new ErroNegocio(404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido de livros não encontrado.')
    this.exigirPedidoAberto(p)
    const texto = compactar(motivo)
    if (!texto) throw validacao('motivo', 'Informe o motivo do cancelamento.')
    if (texto.length > 500) throw validacao('motivo', 'Use até 500 caracteres.')
    Object.assign(p, { status: 'CANCELADO', canceladoEm: hoje().toISOString(), canceladoPor: usuario.nome, motivoCancelamento: texto })
    return this.pedido(id)
  }

  private exigirPedidoAberto(p: PedidoMock): void {
    if (p.status !== 'ABERTO') {
      throw regra('PEDIDO_NAO_ABERTO', p.status === 'RECEBIDO' ? 'Este pedido já foi recebido.' : 'Este pedido foi cancelado.')
    }
  }

  // US-PUBLISHER-005

  devolver(remessaId: number, dados: NovaDevolucao, usuario: Usuario): Devolucao {
    const r = this.remessaMock(remessaId)
    if (r.status === 'CANCELADA') throw regra('REMESSA_CANCELADA', `A remessa ${r.codigo} está cancelada.`)
    travaPeriodo.exigirAberto(dados.devolvidaEm)
    const erros: ErroCampo[] = []
    if (!dados.devolvidaEm) erros.push({ campo: 'devolvidaEm', mensagem: 'Informe a data da devolução.' })
    else if (dados.devolvidaEm > paraIsoData(hoje())) erros.push({ campo: 'devolvidaEm', mensagem: 'A data da devolução não pode ser futura.' })
    else if (dados.devolvidaEm < r.recebidaEm) {
      erros.push({ campo: 'devolvidaEm', mensagem: 'A devolução não pode ser anterior ao recebimento da remessa.' })
    }
    const observacao = compactar(dados.observacao)
    if (observacao.length > 500) erros.push({ campo: 'observacao', mensagem: 'Use até 500 caracteres.' })
    const itens: DevolucaoMock['itens'] = []
    for (const i of dados.itens ?? []) {
      if (!i.quantidade) continue
      const campo = `itens[${i.produtoId}]`
      if (!r.itens.some((x) => x.produtoId === i.produtoId)) {
        erros.push({ campo, mensagem: `O título não faz parte da remessa ${r.codigo}.` })
        continue
      }
      const restante = bancoEstoque.saldoLote(i.produtoId, r.id)
      if (i.quantidade < 0) erros.push({ campo, mensagem: 'A quantidade não pode ser negativa.' })
      else if (i.quantidade > restante) {
        erros.push({ campo, mensagem: `Restam só ${restante} unidade(s) de ${bancoEstoque.produto(i.produtoId).nome} nesta remessa.` })
      } else itens.push({ produtoId: i.produtoId, quantidade: i.quantidade })
    }
    if (itens.length === 0 && !erros.some((e) => e.campo.startsWith('itens'))) {
      erros.push({ campo: 'itens', mensagem: 'Informe a quantidade devolvida de ao menos um título.' })
    }
    if (erros.length > 0) throw validacoes(erros)
    const d: DevolucaoMock = {
      id: this.proximo.devolucao++,
      remessaId,
      devolvidaEm: dados.devolvidaEm,
      observacao: observacao || null,
      itens,
      registradaEm: hoje().toISOString(),
      registradaPor: usuario.nome,
    }
    this.devolucoes.push(d)
    for (const i of itens) bancoEstoque.devolverRemessa(i.produtoId, remessaId, i.quantidade, d.id, usuario)
    return this.paraDevolucao(d)
  }

  devolucao(id: number): Devolucao {
    const d = this.devolucoes.find((x) => x.id === id)
    if (!d) throw new ErroNegocio(404, 'DEVOLUCAO_NAO_ENCONTRADA', 'Devolução não encontrada.')
    return this.paraDevolucao(d)
  }

  // US-PUBLISHER-006

  saldos(): QuadroSaldos {
    const hojeIso = paraIsoData(hoje())
    const editoras = EDITORAS.filter((e) => OBRIGACOES.some((o) => o.editoraId === e.id) || this.pagamentos.some((p) => p.editoraId === e.id))
      .map((e) => ({
        editoraId: e.id,
        nome: e.nome,
        ativa: e.ativa,
        saldoDevido: reais(this.saldoEm(e.id, hojeIso)),
        obrigacaoMaisAntiga: this.abertas(e.id).map((o) => dia(o.criadaEm)!)[0] ?? null,
        ultimoPagamento: this.pagamentos.filter((p) => p.editoraId === e.id && !p.estornadoEm).map((p) => p.pagoEm).sort().at(-1) ?? null,
      }))
      .sort((a, b) => b.saldoDevido - a.saldoDevido || a.nome.localeCompare(b.nome, 'pt-BR'))
    return { editoras, total: reais(soma(editoras.map((e) => centavos(e.saldoDevido)))) }
  }

  saldo(editoraId: number): SaldoDetalhado {
    const e = this.editoraMock(editoraId)
    const obrigacoes = OBRIGACOES.filter((o) => o.editoraId === editoraId).sort(porCriacao)
    const pagamentos = this.pagamentos.filter((p) => p.editoraId === editoraId).sort((a, b) => a.pagoEm.localeCompare(b.pagoEm) || a.id - b.id)
    const total = soma(obrigacoes.map((o) => centavos(o.valor)))
    const estornos = soma(obrigacoes.filter((o) => o.status === 'ESTORNADA').map((o) => centavos(o.valor)))
    const pagos = soma(pagamentos.filter((p) => !p.estornadoEm).map((p) => p.valor))
    return {
      editora: { ...e },
      totalObrigacoes: reais(total),
      totalEstornos: reais(estornos),
      totalPagamentos: reais(pagos),
      saldoDevido: reais(total - estornos - pagos),
      creditoDisponivel: reais(this.credito(editoraId)),
      obrigacoes: obrigacoes.map((o) => this.linhaObrigacao(o)),
      pagamentos: pagamentos.map((p) => this.linhaPagamento(p)),
    }
  }

  // US-PUBLISHER-007

  apuracao(editoraId: number, mes: string): Apuracao {
    const e = this.editoraMock(editoraId)
    if (!/^\d{4}-\d{2}$/.test(mes ?? '')) throw validacao('mes', 'Informe o mês no formato AAAA-MM.')
    const de = `${mes}-01`
    const ate = ultimoDia(mes)
    const dentro = (d: string | null) => d !== null && d >= de && d <= ate
    const [a, m] = mes.split('-').map(Number)
    const anterior = `${m === 1 ? a - 1 : a}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`
    const daEditora = OBRIGACOES.filter((o) => o.editoraId === editoraId).sort(porCriacao)
    const criadas = daEditora.filter((o) => dentro(dia(o.criadaEm)))
    const vendas = criadas.filter((o) => o.origem === 'VENDA')
    const baixas = criadas.filter((o) => o.origem === 'BAIXA')
    const estornadas = daEditora.filter((o) => dentro(dia(o.estornadaEm)))
    const pagamentos = this.pagamentos
      .filter((p) => p.editoraId === editoraId && (dentro(p.pagoEm) || dentro(dia(p.estornadoEm))))
      .sort((x, y) => x.pagoEm.localeCompare(y.pagoEm) || x.id - y.id)
    const somaObrigacoes = (lista: ObrigacaoMock[]) => soma(lista.map((o) => centavos(o.valor)))
    const pagos = soma(pagamentos.filter((p) => dentro(p.pagoEm)).map((p) => p.valor)) - soma(pagamentos.filter((p) => dentro(dia(p.estornadoEm))).map((p) => p.valor))
    const inicial = this.saldoEm(editoraId, paraIsoData(new Date(a, m - 1, 0)))
    const fim = inicial + somaObrigacoes(vendas) + somaObrigacoes(baixas) - somaObrigacoes(estornadas) - pagos
    return {
      organizacao: { ...ORGANIZACAO },
      editora: { ...e },
      mes,
      saldoInicial: reais(inicial),
      transferenciaAnterior: this.transferencias.find((t) => t.editoraId === editoraId && t.mes === anterior) ?? null,
      obrigacoesVendas: reais(somaObrigacoes(vendas)),
      obrigacoesBaixas: reais(somaObrigacoes(baixas)),
      estornos: reais(somaObrigacoes(estornadas)),
      pagamentos: reais(pagos),
      saldoFinal: reais(fim),
      estoque: this.estoque(editoraId, de, ate),
      vendas: vendas.map((o) => this.linhaObrigacao(o)),
      baixas: baixas.map((o) => this.linhaObrigacao(o)),
      estornadas: estornadas.map((o) => this.linhaObrigacao(o)),
      devolucoes: this.devolucoes
        .filter((d) => dentro(d.devolvidaEm) && this.remessaMock(d.remessaId).editoraId === editoraId)
        .flatMap((d) =>
          d.itens.map((i) => ({
            devolucaoId: d.id,
            data: d.devolvidaEm,
            remessaCodigo: this.remessaMock(d.remessaId).codigo,
            titulo: bancoEstoque.produto(i.produtoId).nome,
            quantidade: i.quantidade,
            observacao: d.observacao,
          })),
        ),
      linhasPagamentos: pagamentos.map((p) => this.linhaPagamento(p)),
    }
  }

  /**
   * Acertos do período para o relatório (US-REPORT-009), com as regras da apuração: editoras que já
   * tiveram obrigação ou pagamento; saldos transferidos nos meses que terminam no período.
   */
  acertos(de: string, ate: string) {
    const dentro = (d: string | null) => d !== null && d >= de && d <= ate
    const vespera = paraIsoData(new Date(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)) - 1))
    return EDITORAS.filter((e) => OBRIGACOES.some((o) => o.editoraId === e.id) || this.pagamentos.some((p) => p.editoraId === e.id)).map((e) => {
      const daEditora = OBRIGACOES.filter((o) => o.editoraId === e.id)
      const criadas = daEditora.filter((o) => dentro(dia(o.criadaEm)))
      const somaObrigacoes = (lista: ObrigacaoMock[]) => soma(lista.map((o) => centavos(o.valor)))
      const pagamentos = this.pagamentos.filter((p) => p.editoraId === e.id)
      const pagos = soma(pagamentos.filter((p) => dentro(p.pagoEm)).map((p) => p.valor)) - soma(pagamentos.filter((p) => dentro(dia(p.estornadoEm))).map((p) => p.valor))
      const transferido = soma(this.transferencias.filter((t) => t.editoraId === e.id && dentro(ultimoDia(t.mes))).map((t) => centavos(t.valor)))
      return {
        editoraId: e.id,
        nome: e.nome,
        saldoInicial: reais(this.saldoEm(e.id, vespera)),
        obrigacoesVendas: reais(somaObrigacoes(criadas.filter((o) => o.origem === 'VENDA'))),
        obrigacoesBaixas: reais(somaObrigacoes(criadas.filter((o) => o.origem === 'BAIXA'))),
        estornos: reais(somaObrigacoes(daEditora.filter((o) => dentro(dia(o.estornadaEm))))),
        pagamentos: reais(pagos),
        transferido: reais(transferido),
      }
    })
  }

  // US-PUBLISHER-008

  previa(editoraId: number, valor: number): PreviaPagamento {
    this.editoraMock(editoraId)
    if (!(valor > 0)) throw validacao('valor', 'Informe um valor maior que zero.')
    const abertas = this.abertas(editoraId)
    const saldo = this.saldoDevido(editoraId)
    const usado = Math.min(centavos(valor), Math.max(saldo, 0))
    const aplicado = this.creditoAplicavel(editoraId)
    return {
      saldoDevido: reais(saldo),
      creditoAplicado: reais(aplicado),
      valor: reais(usado),
      alocacoes: this.alocar(abertas, usado + aplicado).map(({ obrigacao, valor: parte }) => this.linhaAlocacao(obrigacao, parte)),
      saldoDepois: reais(saldo - usado),
    }
  }

  pagar(dados: NovoPagamento, usuario: Usuario): ResultadoPagamento {
    const existente = this.pagamentos.find((p) => p.chave === dados.chaveIdempotencia)
    if (existente) return { id: existente.id, lancamentoId: existente.lancamentoId, avisos: [] }
    if (!dados.editoraId) throw validacao('editoraId', 'Escolha a editora.')
    const e = this.editoraMock(dados.editoraId)
    const saldo = this.saldoDevido(e.id)
    if (saldo <= 0) throw regra('SEM_SALDO_DEVIDO', 'Não há saldo devido a esta editora.')
    const erros: ErroCampo[] = []
    const valor = centavos(dados.valor ?? 0)
    if (!(dados.valor > 0)) erros.push({ campo: 'valor', mensagem: 'Informe um valor maior que zero.' })
    else if (Math.abs(dados.valor * 100 - valor) > 1e-6) erros.push({ campo: 'valor', mensagem: 'Use no máximo duas casas decimais.' })
    else if (valor > saldo) erros.push({ campo: 'valor', mensagem: `O valor passa o saldo devido de ${brl(saldo)}.` })
    if (!dados.meio) erros.push({ campo: 'meio', mensagem: 'Escolha o meio de pagamento.' })
    const conta = bancoFinanceiro.contas().find((c) => c.id === dados.contaId && c.ativa)
    if (!conta) erros.push({ campo: 'contaId', mensagem: 'Escolha a conta de origem.' })
    else if (dados.meio && (dados.meio === 'DINHEIRO' ? conta.tipo !== 'CAIXA' : conta.tipo !== 'BANCO')) {
      erros.push({ campo: 'contaId', mensagem: dados.meio === 'DINHEIRO' ? 'Pagamento em dinheiro sai de um caixa.' : 'PIX e transferência saem de uma conta bancária.' })
    }
    if (!dados.pagoEm) erros.push({ campo: 'pagoEm', mensagem: 'Informe a data do pagamento.' })
    else if (dados.pagoEm > paraIsoData(hoje())) erros.push({ campo: 'pagoEm', mensagem: 'A data do pagamento não pode ser futura.' })
    const observacao = compactar(dados.observacao)
    if (observacao.length > 500) erros.push({ campo: 'observacao', mensagem: 'Use até 500 caracteres.' })
    if (erros.length > 0) throw validacoes(erros)
    const id = this.proximo.pagamento
    // Primeiro a despesa: se ela for recusada (ex.: caixa ficaria negativo), nada muda.
    const despesa = bancoFinanceiro.lancarDespesa(
      {
        data: dados.pagoEm,
        origemTipo: 'PAGAMENTO_EDITORA',
        origemId: id,
        descricao: `Repasse à editora ${e.nome} (pagamento nº ${id})`,
        contas: [{ contaId: conta!.id, valor: -reais(valor) }],
        categorias: [{ categoria: CATEGORIA.REPASSE_EDITORAS, valor: -reais(valor) }],
      },
      usuario,
    )
    this.proximo.pagamento++
    const aplicado = this.creditoAplicavel(e.id)
    const alocacoes = this.alocar(this.abertas(e.id), valor + aplicado)
    for (const { obrigacao, valor: parte } of alocacoes) {
      obrigacao.valorPago = reais(centavos(obrigacao.valorPago) + parte)
      obrigacao.status = centavos(obrigacao.valorPago) === centavos(obrigacao.valor) ? 'PAGA' : 'PARCIALMENTE_PAGA'
    }
    this.pagamentos.push({
      id,
      editoraId: e.id,
      pagoEm: dados.pagoEm,
      valor,
      creditoAplicado: aplicado,
      contaId: conta!.id,
      contaNome: conta!.nome,
      meio: dados.meio,
      observacao: observacao || null,
      lancamentoId: despesa.id,
      chave: dados.chaveIdempotencia,
      registradoEm: hoje().toISOString(),
      registradoPor: usuario.nome,
      estornadoEm: null,
      alocacoes: alocacoes.map(({ obrigacao, valor: parte }) => ({ obrigacaoId: obrigacao.id, valor: parte })),
    })
    return { id, lancamentoId: despesa.id, avisos: despesa.avisos }
  }

  recibo(id: number): ReciboPagamento {
    const p = this.pagamentos.find((x) => x.id === id)
    if (!p) throw new ErroNegocio(404, 'PAGAMENTO_NAO_ENCONTRADO', 'Pagamento não encontrado.')
    const e = this.editoraMock(p.editoraId)
    return {
      id: p.id,
      editoraId: e.id,
      editoraNome: e.nome,
      editoraCnpj: e.cnpj,
      pagoEm: p.pagoEm,
      valor: reais(p.valor),
      creditoAplicado: reais(p.creditoAplicado),
      contaNome: p.contaNome,
      meio: p.meio,
      observacao: p.observacao,
      lancamentoId: p.lancamentoId,
      registradoEm: p.registradoEm,
      registradoPor: p.registradoPor,
      estornadoEm: p.estornadoEm,
      alocacoes: p.alocacoes.map((a) => {
        const o = OBRIGACOES.find((x) => x.id === a.obrigacaoId)!
        return { ...this.linhaAlocacao(o, a.valor), valorAberto: o.valor, restante: reais(this.aberto(o)) }
      }),
      organizacao: { ...ORGANIZACAO },
    }
  }

  /** A despesa foi estornada no Financeiro: reabre as obrigações cobertas (US-FINANCIAL-010). */
  aoEstornar(pagamentoId: number): void {
    const p = this.pagamentos.find((x) => x.id === pagamentoId)
    if (!p || p.estornadoEm) return
    p.estornadoEm = hoje().toISOString()
    for (const a of p.alocacoes) {
      const o = OBRIGACOES.find((x) => x.id === a.obrigacaoId)!
      o.valorPago = reais(centavos(o.valorPago) - a.valor)
      if (o.status === 'ESTORNADA') CREDITOS.push({ editoraId: o.editoraId, obrigacaoId: o.id, valor: -reais(a.valor) })
      else o.status = centavos(o.valorPago) === 0 ? 'ABERTA' : 'PARCIALMENTE_PAGA'
    }
  }

  // US-PUBLISHER-010

  fechamento(mes: string): FechamentoEditoras {
    if (!/^\d{4}-\d{2}$/.test(mes ?? '')) throw validacao('mes', 'Informe o mês no formato AAAA-MM.')
    const fim = ultimoDia(mes)
    const editoras = EDITORAS.map((e) => ({ e, saldo: this.saldoEm(e.id, fim) }))
      .filter(({ saldo }) => saldo > 0)
      .map(({ e, saldo }) => {
        const t = this.transferencias.find((x) => x.editoraId === e.id && x.mes === mes) ?? null
        return { editoraId: e.id, nome: e.nome, saldoNoFimDoMes: reais(saldo), situacao: t ? ('TRANSFERIDA' as const) : ('PENDENTE' as const), transferencia: t }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return { mes, editoras, concluido: editoras.every((i) => i.transferencia !== null) }
  }

  transferir(dados: { editoraId: number; mes: string; nota: string }, usuario: Usuario): TransferenciaSaldo {
    if (!dados.editoraId) throw validacao('editoraId', 'Escolha a editora.')
    const e = this.editoraMock(dados.editoraId)
    travaPeriodo.exigirAberto(dados.mes)
    if (this.transferencias.some((t) => t.editoraId === e.id && t.mes === dados.mes)) {
      throw regra('SALDO_JA_TRANSFERIDO', `O saldo de ${e.nome} deste mês já foi transferido.`)
    }
    if (!dados.mes) throw validacao('mes', 'Informe o mês.')
    if (dados.mes > paraIsoData(hoje()).slice(0, 7)) throw validacao('mes', 'O mês não pode ser futuro.')
    const nota = compactar(dados.nota)
    if (!nota) throw validacao('nota', 'Explique a transferência (ex.: combinado com a editora pagar em 15/11).')
    if (nota.length > 500) throw validacao('nota', 'Use até 500 caracteres.')
    const saldo = this.saldoEm(e.id, ultimoDia(dados.mes))
    if (saldo <= 0) throw regra('SEM_SALDO_DEVIDO', 'A editora não tem saldo devido no fim do mês.')
    const t: TransferenciaSaldo = {
      id: this.proximo.transferencia++,
      editoraId: e.id,
      mes: dados.mes,
      valor: reais(saldo),
      nota,
      usuarioSubject: usuario.id,
      usuarioNome: usuario.nome,
      registradaEm: hoje().toISOString(),
    }
    this.transferencias.push(t)
    return t
  }

  // Apoio

  private validar(dados: DadosEditora, excetoId: number | null): Omit<EditoraMock, 'id' | 'ativa'> {
    const erros: ErroCampo[] = []
    const nome = compactar(dados.nome)
    if (!nome) erros.push({ campo: 'nome', mensagem: 'Informe o nome da editora.' })
    else if (nome.length > 200) erros.push({ campo: 'nome', mensagem: 'Use até 200 caracteres.' })
    const cnpj = apenasDigitos(dados.cnpj ?? '')
    if (!cnpj) erros.push({ campo: 'cnpj', mensagem: 'Informe o CNPJ.' })
    else if (!validarCnpj(cnpj)) erros.push({ campo: 'cnpj', mensagem: 'CNPJ inválido.' })
    const telefone = apenasDigitos(dados.telefone ?? '')
    if (telefone && (telefone.length < 10 || telefone.length > 11)) erros.push({ campo: 'telefone', mensagem: 'Informe o telefone com DDD.' })
    const email = compactar(dados.email).toLowerCase()
    if (email && !validarEmail(email)) erros.push({ campo: 'email', mensagem: 'E-mail inválido.' })
    const observacoes = compactar(dados.observacoes)
    if (observacoes.length > 1000) erros.push({ campo: 'observacoes', mensagem: 'Use até 1000 caracteres.' })
    if (erros.length > 0) throw validacoes(erros)
    if (EDITORAS.some((e) => e.cnpj === cnpj && e.id !== excetoId)) throw validacao('cnpj', 'Já existe uma editora com este CNPJ.')
    return {
      nome,
      cnpj,
      contatoNome: opcional(dados.contatoNome),
      telefone: telefone || null,
      email: email || null,
      banco: opcional(dados.banco),
      agencia: opcional(dados.agencia),
      conta: opcional(dados.conta),
      chavePix: opcional(dados.chavePix),
      observacoes: observacoes || null,
    }
  }

  private editoraMock(id: number): EditoraMock {
    const e = EDITORAS.find((x) => x.id === id)
    if (!e) throw new ErroNegocio(404, 'EDITORA_NAO_ENCONTRADA', 'Editora não encontrada.')
    return e
  }

  private remessaMock(id: number): RemessaMock {
    const r = REMESSAS.find((x) => x.id === id)
    if (!r) throw new ErroNegocio(404, 'REMESSA_NAO_ENCONTRADA', 'Remessa não encontrada.')
    return r
  }

  private situacao(r: RemessaMock): SituacaoRemessa {
    if (r.status === 'CANCELADA') return 'CANCELADA'
    return r.itens.every((i) => bancoEstoque.saldoLote(i.produtoId, r.id) === 0) ? 'ENCERRADA' : 'ABERTA'
  }

  private resumoRemessa(r: RemessaMock): ResumoRemessa {
    return {
      id: r.id,
      codigo: r.codigo,
      editoraId: r.editoraId,
      editoraNome: this.editoraMock(r.editoraId).nome,
      recebidaEm: r.recebidaEm,
      numeroDocumento: r.numeroDocumento,
      situacao: this.situacao(r),
      recebidas: soma(r.itens.map((i) => i.quantidade)),
      restantes: soma(r.itens.map((i) => bancoEstoque.saldoLote(i.produtoId, r.id))),
    }
  }

  private paraDevolucao(d: DevolucaoMock): Devolucao {
    const r = this.remessaMock(d.remessaId)
    const e = this.editoraMock(r.editoraId)
    return {
      id: d.id,
      remessaId: r.id,
      remessaCodigo: r.codigo,
      editoraId: e.id,
      editoraNome: e.nome,
      editoraCnpj: e.cnpj,
      devolvidaEm: d.devolvidaEm,
      observacao: d.observacao,
      registradaEm: d.registradaEm,
      registradaPor: d.registradaPor,
      itens: d.itens.map((i) => {
        const p = bancoEstoque.produto(i.produtoId)
        return { produtoId: p.id, titulo: p.nome, isbn: p.isbn, quantidade: i.quantidade }
      }),
      organizacao: { ...ORGANIZACAO },
    }
  }

  /** Obrigações − estornos − pagamentos não estornados no fim do dia, em centavos. */
  private saldoEm(editoraId: number, ate: string): number {
    const atePrazo = (d: string | null) => d !== null && d <= ate
    const obrigacoes = OBRIGACOES.filter((o) => o.editoraId === editoraId)
    const pagamentos = this.pagamentos.filter((p) => p.editoraId === editoraId)
    return (
      soma(obrigacoes.filter((o) => atePrazo(dia(o.criadaEm))).map((o) => centavos(o.valor))) -
      soma(obrigacoes.filter((o) => atePrazo(dia(o.estornadaEm))).map((o) => centavos(o.valor))) -
      soma(pagamentos.filter((p) => atePrazo(p.pagoEm)).map((p) => p.valor)) +
      soma(pagamentos.filter((p) => atePrazo(dia(p.estornadoEm))).map((p) => p.valor))
    )
  }

  private abertas(editoraId: number): ObrigacaoMock[] {
    return OBRIGACOES.filter((o) => o.editoraId === editoraId && EM_ABERTO.has(o.status)).sort(porCriacao)
  }

  private aberto(o: ObrigacaoMock): number {
    return o.status === 'ESTORNADA' ? 0 : centavos(o.valor) - centavos(o.valorPago)
  }

  private credito(editoraId: number): number {
    return (
      soma(CREDITOS.filter((c) => c.editoraId === editoraId).map((c) => centavos(c.valor))) -
      soma(this.pagamentos.filter((p) => p.editoraId === editoraId && !p.estornadoEm).map((p) => p.creditoAplicado))
    )
  }

  private saldoDevido(editoraId: number): number {
    return soma(this.abertas(editoraId).map((o) => this.aberto(o))) - this.credito(editoraId)
  }

  private creditoAplicavel(editoraId: number): number {
    const credito = this.credito(editoraId)
    return credito <= 0 ? 0 : Math.min(credito, soma(this.abertas(editoraId).map((o) => this.aberto(o))))
  }

  /** Da mais antiga para a mais nova; valores em centavos. */
  private alocar(abertas: ObrigacaoMock[], total: number): { obrigacao: ObrigacaoMock; valor: number }[] {
    const alocacoes: { obrigacao: ObrigacaoMock; valor: number }[] = []
    let resta = total
    for (const o of abertas) {
      if (resta <= 0) break
      const parte = Math.min(resta, this.aberto(o))
      if (parte > 0) {
        alocacoes.push({ obrigacao: o, valor: parte })
        resta -= parte
      }
    }
    return alocacoes
  }

  private linhaObrigacao(o: ObrigacaoMock): LinhaObrigacao {
    return {
      id: o.id,
      data: dia(o.criadaEm)!,
      origem: o.origem,
      origemId: o.origemId,
      origemNumero: o.origemNumero,
      remessaCodigo: this.remessaMock(o.remessaId).codigo,
      produtoId: o.produtoId,
      titulo: bancoEstoque.produto(o.produtoId).nome,
      quantidade: o.quantidade,
      precoUnitario: o.precoUnitario,
      repassePercentual: o.repassePercentual,
      valor: o.valor,
      valorPago: o.valorPago,
      valorAberto: reais(this.aberto(o)),
      status: o.status,
      estornadaEm: dia(o.estornadaEm),
    }
  }

  /** `parte` em centavos; `valorAberto` e `restante` antes e depois desta alocação. */
  private linhaAlocacao(o: ObrigacaoMock, parte: number): LinhaAlocacao {
    const aberto = this.aberto(o)
    return {
      obrigacaoId: o.id,
      data: dia(o.criadaEm)!,
      origem: o.origem,
      origemNumero: o.origemNumero,
      remessaCodigo: this.remessaMock(o.remessaId).codigo,
      titulo: bancoEstoque.produto(o.produtoId).nome,
      valorAberto: reais(aberto),
      valorAlocado: reais(parte),
      restante: reais(aberto - parte),
    }
  }

  private linhaPagamento(p: PagamentoMock): LinhaPagamento {
    return {
      id: p.id,
      pagoEm: p.pagoEm,
      valor: reais(p.valor),
      creditoAplicado: reais(p.creditoAplicado),
      contaNome: p.contaNome,
      meio: p.meio,
      observacao: p.observacao,
      registradoPor: p.registradoPor,
      lancamentoId: p.lancamentoId,
      estornadoEm: dia(p.estornadoEm),
    }
  }

  private estoque(editoraId: number, de: string, ate: string): EstoqueRemessa[] {
    const linhas = new Map<string, EstoqueRemessa>()
    for (const m of bancoEstoque.movimentosDeRemessas()) {
      const r = REMESSAS.find((x) => x.id === m.remessaId)
      const d = dia(m.ocorridoEm)!
      if (!r || r.editoraId !== editoraId || d > ate) continue
      const chave = `${r.codigo}|${m.produtoId}`
      const l =
        linhas.get(chave) ??
        { remessaId: r.id, remessaCodigo: r.codigo, produtoId: m.produtoId, titulo: bancoEstoque.produto(m.produtoId).nome, inicial: 0, recebida: 0, vendida: 0, devolvida: 0, baixada: 0, outros: 0, fim: 0 }
      linhas.set(chave, l)
      l.fim += m.quantidade
      if (d < de) l.inicial += m.quantidade
      else if (m.tipo === 'ENTRADA_REMESSA') l.recebida += m.quantidade
      else if (m.tipo === 'VENDA' || m.tipo === 'CANCELAMENTO_VENDA') l.vendida -= m.quantidade
      else if (m.tipo === 'DEVOLUCAO_EDITORA') l.devolvida -= m.quantidade
      else if (m.tipo.startsWith('BAIXA_')) l.baixada -= m.quantidade
      else l.outros += m.quantidade
    }
    return [...linhas.values()]
      .filter((l) => l.inicial !== 0 || l.recebida || l.vendida || l.devolvida || l.baixada || l.outros)
      .sort((a, b) => a.remessaCodigo.localeCompare(b.remessaCodigo) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  }
}

const porCriacao = (a: ObrigacaoMock, b: ObrigacaoMock) => a.criadaEm.localeCompare(b.criadaEm) || a.id - b.id

export const bancoEditoras = new BancoEditoras()
