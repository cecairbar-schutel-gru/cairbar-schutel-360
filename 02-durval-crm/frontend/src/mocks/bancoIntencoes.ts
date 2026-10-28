import type { Usuario } from '../auth'
import type {
  AnexoEnviado,
  Aprovacao,
  Contadores,
  DadosAprovacao,
  DetalheIntencao,
  EventoIntencao,
  FiltroFila,
  ItemCompra,
  ItemQuantidade,
  NovaIntencao,
  OpcoesIntencao,
  ResultadoAcao,
  ResumoIntencao,
  StatusIntencao,
} from '../features/intencoes/types'
import { MAXIMO_ANEXO_BYTES, MAXIMO_ANEXOS, MAXIMO_TEXTO } from '../features/intencoes/types'
import { ROTULO_MEIO, ROTULO_STATUS } from '../features/intencoes/rotulos'
import type { ErroCampo } from '../shared/api/http'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import { bancoEstoque } from './bancoEstoque'
import { bancoFinanceiro, CONTAS } from './bancoFinanceiro'
import { ErroNegocio } from './erroNegocio'

const COMPRA_CANTINA = 'DESPESAS_COMERCIAIS.COMPRA_CANTINA'
/** Subcategorias com fluxo próprio, fora das intenções (US-EXPENSE-001). */
const FORA = new Set(['DESPESAS_COMERCIAIS.REPASSE_EDITORAS', 'DESPESAS_COMERCIAIS.TAXAS_CARTAO'])
const TIPOS_ANEXO = ['application/pdf', 'image/jpeg', 'image/png']

interface IntencaoMock {
  id: number
  descricao: string
  categoria: string
  valorSolicitado: number
  justificativa: string
  itens: ItemCompra[]
  status: StatusIntencao
  solicitanteId: string
  solicitanteNome: string
  criadaEm: string
  statusAlteradoEm: string
  aprovacao: Aprovacao | null
  decididaPorId: string | null
  decididaPorNome: string | null
  decididaEm: string | null
  motivoRejeicao: string | null
  recebidaPorNome: string | null
  recebidaEm: string | null
  divergencia: string | null
  canceladaPorNome: string | null
  canceladaEm: string | null
  motivoCancelamento: string | null
  anexos: AnexoEnviado[]
  historico: EventoIntencao[]
}

const brl = (v: number) => formatarMoeda(v).replace(/ /g, ' ')
const dataBr = (iso: string) => iso.split('-').reverse().join('/')
const centavos = (v: number) => Math.round(v * 100)
const validacao = (erros: ErroCampo[]) => {
  if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
}
const campo = (c: string, mensagem: string) => validacao([{ campo: c, mensagem }])
const compactar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ')
const tesouraria = (u: Usuario) => u.papeis.includes('tesoureiro') || u.papeis.includes('administrador')

function exigirValor(valor: number | null | undefined, nome: string, erros: ErroCampo[]) {
  if (valor === null || valor === undefined || Number.isNaN(valor) || valor <= 0) erros.push({ campo: nome, mensagem: 'Informe um valor maior que zero.' })
  else if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) erros.push({ campo: nome, mensagem: 'Use no máximo duas casas decimais.' })
}

function texto(valor: string | null | undefined, nome: string, mensagem: string, erros: ErroCampo[]): string {
  const t = compactar(valor)
  if (!t) erros.push({ campo: nome, mensagem })
  else if (t.length > MAXIMO_TEXTO) erros.push({ campo: nome, mensagem: 'Use até 1000 caracteres.' })
  return t
}

/** Espelho simulado do módulo Intenções de gasto do backend (US-EXPENSE-001 a 009). */
class BancoIntencoes {
  private registros: IntencaoMock[] = []
  private visitas = new Map<string, string>()
  private proximoId = 1

  reiniciar(): void {
    this.registros = []
    this.visitas = new Map()
    this.proximoId = 1
  }

  private categorias() {
    return bancoFinanceiro.categorias()
  }

  private categoriaDisponivel(codigo: string | null | undefined) {
    const c = this.categorias().find((x) => x.codigo === codigo)
    return c && c.categoriaPai !== null && c.ativa && c.tipo === 'DESPESA' && !FORA.has(c.codigo) ? c : null
  }

  private nomeCategoria(codigo: string): string {
    return this.categorias().find((c) => c.codigo === codigo)?.nomeCompleto ?? codigo
  }

  private produtosCantina() {
    return bancoEstoque.todos().filter((p) => p.tipo === 'CANTINA' && p.ativo)
  }

  private obter(id: number): IntencaoMock {
    const i = this.registros.find((x) => x.id === id)
    if (!i) throw new ErroNegocio(404, 'INTENCAO_NAO_ENCONTRADA', 'Intenção de gasto não encontrada.')
    return i
  }

  private visivel(id: number, usuario: Usuario): IntencaoMock {
    const i = this.obter(id)
    const vendedor =
      usuario.papeis.includes('vendedor') && i.categoria === COMPRA_CANTINA && ['AGUARDANDO_RECEBIMENTO', 'DIVERGENTE', 'RECEBIDA'].includes(i.status)
    if (tesouraria(usuario) || i.solicitanteId === usuario.id || vendedor) return i
    throw new ErroNegocio(404, 'INTENCAO_NAO_ENCONTRADA', 'Intenção de gasto não encontrada.')
  }

  private exigir(i: IntencaoMock, status: StatusIntencao) {
    if (i.status !== status) {
      throw new ErroNegocio(409, 'INTENCAO_EM_OUTRA_SITUACAO', `A intenção nº ${i.id} está ${ROTULO_STATUS[i.status].toLowerCase()}.`)
    }
  }

  private mudar(i: IntencaoMock, status: StatusIntencao) {
    i.status = status
    i.statusAlteradoEm = hoje().toISOString()
  }

  private evento(i: IntencaoMock, tipo: string, usuario: Usuario, descricao: string) {
    i.historico.push({ tipo, usuario: usuario.nome, em: hoje().toISOString(), descricao })
  }

  private resumo(i: IntencaoMock, novidade = false): ResumoIntencao {
    return {
      id: i.id,
      criadaEm: i.criadaEm,
      solicitanteNome: i.solicitanteNome,
      descricao: i.descricao,
      categoria: i.categoria,
      categoriaNome: this.nomeCategoria(i.categoria),
      valorSolicitado: i.valorSolicitado,
      valorAprovado: i.aprovacao?.valor ?? null,
      status: i.status,
      statusAlteradoEm: i.statusAlteradoEm,
      anexos: i.anexos.length,
      itens: structuredClone(i.itens),
      novidade,
    }
  }

  private lancarDespesa(i: IntencaoMock, usuario: Usuario): ResultadoAcao {
    const a = i.aprovacao!
    const descricao = `Intenção de gasto nº ${i.id}: ${i.descricao}`.slice(0, 200)
    const r = bancoFinanceiro.lancarDespesa(
      {
        data: a.data,
        origemTipo: 'INTENCAO_GASTO',
        origemId: i.id,
        descricao,
        contas: [{ contaId: a.contaId, valor: -a.valor }],
        categorias: [{ categoria: a.categoria, valor: -a.valor }],
      },
      usuario,
    )
    a.lancamentoId = r.id
    return { id: i.id, status: i.status, lancamentoId: r.id, avisos: r.avisos }
  }

  // Opções e US-EXPENSE-001

  opcoes(usuario: Usuario): OpcoesIntencao {
    const todas = this.categorias()
    const subs = todas.filter((c) => this.categoriaDisponivel(c.codigo))
    const categorias = todas
      .filter((m) => m.categoriaPai === null && subs.some((s) => s.categoriaPai === m.codigo))
      .flatMap((m) => [m, ...subs.filter((s) => s.categoriaPai === m.codigo)])
      .map((c) => ({ codigo: c.codigo, nome: c.nome, categoriaPai: c.categoriaPai, nomeCompleto: c.nomeCompleto, compraCantina: c.codigo === COMPRA_CANTINA }))
    const contas = tesouraria(usuario)
      ? CONTAS.filter((c) => c.ativa && (c.tipo === 'CAIXA' || c.tipo === 'BANCO')).map((c) => ({
          id: c.id,
          nome: c.nome,
          tipo: c.tipo as 'CAIXA' | 'BANCO',
          saldo: bancoFinanceiro.saldo(c.id),
        }))
      : []
    return {
      categorias,
      produtos: this.produtosCantina().map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria })),
      contas,
    }
  }

  criar(dados: NovaIntencao, usuario: Usuario): ResultadoAcao {
    const anexos = dados.anexos ?? []
    if (anexos.length > MAXIMO_ANEXOS) campo('anexos', 'Anexe no máximo 5 arquivos.')
    for (const a of anexos) {
      if (!TIPOS_ANEXO.includes(a.tipo)) campo('anexos', `${a.nome}: o anexo deve ser PDF, JPG ou PNG.`)
      if (atob(a.conteudoBase64).length > MAXIMO_ANEXO_BYTES) campo('anexos', `${a.nome}: cada anexo deve ter até 10 MB.`)
    }
    const erros: ErroCampo[] = []
    const descricao = compactar(dados.descricao)
    if (!descricao || descricao.length > 200) erros.push({ campo: 'descricao', mensagem: 'Descreva o gasto (até 200 caracteres).' })
    const categoria = this.categoriaDisponivel(dados.categoria)
    if (!categoria) erros.push({ campo: 'categoria', mensagem: 'Escolha uma subcategoria de despesa ativa.' })
    exigirValor(dados.valor, 'valor', erros)
    const justificativa = texto(dados.justificativa, 'justificativa', 'Explique o motivo da despesa.', erros)
    const pedidos = dados.itens ?? []
    const itens: ItemCompra[] = []
    for (const p of pedidos) {
      const produto = this.produtosCantina().find((x) => x.id === p.produtoId)
      if (!produto) erros.push({ campo: `itens[${p.produtoId}]`, mensagem: 'Escolha um produto ativo da cantina.' })
      else if (!Number.isInteger(p.quantidade) || p.quantidade <= 0) erros.push({ campo: `itens[${p.produtoId}]`, mensagem: 'Informe uma quantidade inteira positiva.' })
      else if (itens.some((i) => i.produtoId === p.produtoId)) erros.push({ campo: `itens[${p.produtoId}]`, mensagem: `${produto.nome} aparece mais de uma vez.` })
      else itens.push({ produtoId: produto.id, produtoNome: produto.nome, quantidade: p.quantidade, quantidadeRecebida: null })
    }
    if (categoria?.codigo === COMPRA_CANTINA && pedidos.length === 0) erros.push({ campo: 'itens', mensagem: 'Liste os produtos da cantina e as quantidades.' })
    if (categoria && categoria.codigo !== COMPRA_CANTINA && pedidos.length > 0) erros.push({ campo: 'itens', mensagem: 'Só a compra de produtos da cantina tem lista de itens.' })
    validacao(erros)
    const agora = hoje().toISOString()
    const i: IntencaoMock = {
      id: this.proximoId++,
      descricao,
      categoria: categoria!.codigo,
      valorSolicitado: dados.valor,
      justificativa,
      itens,
      status: 'PENDENTE',
      solicitanteId: usuario.id,
      solicitanteNome: usuario.nome,
      criadaEm: agora,
      statusAlteradoEm: agora,
      aprovacao: null,
      decididaPorId: null,
      decididaPorNome: null,
      decididaEm: null,
      motivoRejeicao: null,
      recebidaPorNome: null,
      recebidaEm: null,
      divergencia: null,
      canceladaPorNome: null,
      canceladaEm: null,
      motivoCancelamento: null,
      anexos: structuredClone(anexos),
      historico: [],
    }
    const lista = itens.length ? `: ${itens.map((x) => `${x.quantidade} × ${x.produtoNome}`).join(', ')}` : ''
    this.evento(i, 'CRIADA', usuario, `Pedido de ${brl(dados.valor)} em ${categoria!.nomeCompleto}${lista}.`)
    this.registros.push(i)
    return { id: i.id, status: i.status, lancamentoId: null, avisos: [] }
  }

  // US-EXPENSE-008 e 009

  minhas(usuario: Usuario, status?: StatusIntencao): ResumoIntencao[] {
    const visita = this.visitas.get(usuario.id)
    return this.registros
      .filter((i) => i.solicitanteId === usuario.id && (!status || i.status === status))
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm) || b.id - a.id)
      .map((i) => this.resumo(i, visita !== undefined && i.status !== 'PENDENTE' && i.statusAlteradoEm > visita))
  }

  registrarVisita(usuario: Usuario): void {
    this.visitas.set(usuario.id, hoje().toISOString())
  }

  retirar(id: number, motivo: string, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    if (i.solicitanteId !== usuario.id) throw new ErroNegocio(404, 'INTENCAO_NAO_ENCONTRADA', 'Intenção de gasto não encontrada.')
    this.exigir(i, 'PENDENTE')
    const erros: ErroCampo[] = []
    const t = texto(motivo, 'motivo', 'Informe o motivo da desistência.', erros)
    validacao(erros)
    this.cancelar(i, t, usuario)
    this.evento(i, 'RETIRADA', usuario, `Retirada pelo solicitante: ${t}`)
    return { id, status: i.status, lancamentoId: null, avisos: [] }
  }

  private cancelar(i: IntencaoMock, motivo: string, usuario: Usuario) {
    i.motivoCancelamento = motivo
    i.canceladaPorNome = usuario.nome
    i.canceladaEm = hoje().toISOString()
    this.mudar(i, 'CANCELADA')
  }

  // US-EXPENSE-002

  fila(filtro: FiltroFila | StatusIntencao): ResumoIntencao[] {
    if (filtro === 'TODAS') {
      return [...this.registros].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm) || b.id - a.id).map((i) => this.resumo(i))
    }
    return this.registros
      .filter((i) => i.status === filtro)
      .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm) || a.id - b.id)
      .map((i) => this.resumo(i))
  }

  /** Item "Intenções de gasto" do checklist do fechamento (US-CLOSING-001). */
  emAbertoCriadasAntesDe(limite: string): number {
    return this.registros.filter((i) => (i.status === 'PENDENTE' || i.status === 'DIVERGENTE') && i.criadaEm < limite).length
  }

  contadores(): Contadores {
    const contar = (s: StatusIntencao) => this.registros.filter((i) => i.status === s).length
    return { pendentes: contar('PENDENTE'), divergentes: contar('DIVERGENTE'), aguardandoRecebimento: contar('AGUARDANDO_RECEBIMENTO') }
  }

  recebimentos(): ResumoIntencao[] {
    return this.fila('AGUARDANDO_RECEBIMENTO')
  }

  detalhe(id: number, usuario: Usuario): DetalheIntencao {
    const i = this.visivel(id, usuario)
    const tes = tesouraria(usuario)
    const propria = i.solicitanteId === usuario.id
    const { solicitanteId: _s, decididaPorId: _d, anexos, historico, ...resto } = i
    void _s
    void _d
    return {
      ...structuredClone(resto),
      categoriaNome: this.nomeCategoria(i.categoria),
      compraCantina: i.categoria === COMPRA_CANTINA,
      anexos: anexos.map((a, n) => ({ ordem: n + 1, nome: a.nome, tipo: a.tipo, tamanho: atob(a.conteudoBase64).length })),
      historico: structuredClone(historico),
      gastoNoMes: tes ? bancoFinanceiro.despesasNoMes(i.categoria, paraIsoData(hoje()).slice(0, 7)) : null,
      acoes: {
        decidir: tes && i.status === 'PENDENTE',
        resolverDivergencia: tes && i.status === 'DIVERGENTE',
        retirar: propria && i.status === 'PENDENTE',
        receber: usuario.papeis.includes('vendedor') && i.status === 'AGUARDANDO_RECEBIMENTO',
        copiar: propria && usuario.papeis.includes('vendedor') && i.status === 'REJEITADA',
      },
    }
  }

  anexo(id: number, ordem: number, usuario: Usuario): AnexoEnviado {
    const a = this.visivel(id, usuario).anexos[ordem - 1]
    if (!a) throw new ErroNegocio(404, 'ANEXO_NAO_ENCONTRADO', 'Anexo não encontrado.')
    return a
  }

  // US-EXPENSE-004 e 005

  aprovar(id: number, dados: DadosAprovacao, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    this.exigir(i, 'PENDENTE')
    const erros: ErroCampo[] = []
    exigirValor(dados.valor, 'valor', erros)
    const categoria = this.categoriaDisponivel(dados.categoria)
    const cantina = i.categoria === COMPRA_CANTINA
    if (!categoria) erros.push({ campo: 'categoria', mensagem: 'Escolha uma subcategoria de despesa ativa.' })
    else if ((categoria.codigo === COMPRA_CANTINA) !== cantina) {
      erros.push({
        campo: 'categoria',
        mensagem: cantina ? 'Uma compra da cantina continua em Compra de produtos da cantina.' : 'Só pedidos com lista de produtos entram em Compra de produtos da cantina.',
      })
    }
    if (!dados.meio) erros.push({ campo: 'meio', mensagem: 'Escolha o meio de pagamento.' })
    const conta = CONTAS.find((c) => c.id === dados.contaId && c.ativa)
    if (!conta) erros.push({ campo: 'contaId', mensagem: 'Escolha a conta de origem.' })
    else if (dados.meio && (dados.meio === 'DINHEIRO' ? conta.tipo !== 'CAIXA' : conta.tipo !== 'BANCO')) {
      erros.push({ campo: 'contaId', mensagem: dados.meio === 'DINHEIRO' ? 'Pagamento em dinheiro sai de um caixa.' : 'PIX, transferência e boleto saem de uma conta bancária.' })
    }
    if (!dados.data) erros.push({ campo: 'data', mensagem: 'Informe a data do pagamento.' })
    else if (dados.data > paraIsoData(hoje())) erros.push({ campo: 'data', mensagem: 'A data do pagamento não pode ser futura.' })
    const nota = compactar(dados.nota)
    const ajustada = centavos(dados.valor) !== centavos(i.valorSolicitado) || dados.categoria !== i.categoria
    if (ajustada && !nota) erros.push({ campo: 'nota', mensagem: 'Explique o ajuste de valor ou de categoria.' })
    validacao(erros)
    const anterior = structuredClone(i)
    i.aprovacao = {
      valor: dados.valor,
      categoria: categoria!.codigo,
      categoriaNome: categoria!.nomeCompleto,
      meio: dados.meio,
      contaId: conta!.id,
      contaNome: conta!.nome,
      data: dados.data,
      nota: nota || null,
      lancamentoId: null,
    }
    i.decididaPorId = usuario.id
    i.decididaPorNome = usuario.nome
    i.decididaEm = hoje().toISOString()
    this.mudar(i, cantina ? 'AGUARDANDO_RECEBIMENTO' : 'APROVADA')
    try {
      const r = this.lancarDespesa(i, usuario)
      this.evento(
        i,
        'APROVADA',
        usuario,
        `Aprovada: ${brl(dados.valor)} em ${categoria!.nomeCompleto}, ${ROTULO_MEIO[dados.meio].toLowerCase()} de ${conta!.nome}, pagamento em ${dataBr(dados.data)}.${nota ? ` Nota: ${nota}` : ''}`,
      )
      return r
    } catch (e) {
      Object.assign(i, anterior)
      throw e
    }
  }

  rejeitar(id: number, motivo: string, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    this.exigir(i, 'PENDENTE')
    const erros: ErroCampo[] = []
    const t = texto(motivo, 'motivo', 'Informe o motivo da rejeição.', erros)
    validacao(erros)
    i.motivoRejeicao = t
    i.decididaPorId = usuario.id
    i.decididaPorNome = usuario.nome
    i.decididaEm = hoje().toISOString()
    this.mudar(i, 'REJEITADA')
    this.evento(i, 'REJEITADA', usuario, `Rejeitada: ${t}`)
    return { id, status: i.status, lancamentoId: null, avisos: [] }
  }

  // US-EXPENSE-006

  receber(id: number, itens: ItemQuantidade[], divergencia: string, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    this.exigir(i, 'AGUARDANDO_RECEBIMENTO')
    const erros: ErroCampo[] = []
    const recebidas = new Map(itens.map((x) => [x.produtoId, x.quantidade]))
    for (const item of i.itens) {
      const q = recebidas.get(item.produtoId)
      if (q === undefined || q === null || !Number.isInteger(q) || q < 0) {
        erros.push({ campo: `itens[${item.produtoId}]`, mensagem: `Informe quanto chegou de ${item.produtoNome} (zero se não chegou).` })
      }
    }
    validacao(erros)
    const confere = i.itens.every((x) => recebidas.get(x.produtoId) === x.quantidade)
    const t = compactar(divergencia)
    if (!confere && !t) campo('divergencia', 'Descreva a divergência para a Tesouraria.')
    i.itens = i.itens.map((x) => ({ ...x, quantidadeRecebida: recebidas.get(x.produtoId)! }))
    i.recebidaPorNome = usuario.nome
    i.recebidaEm = hoje().toISOString()
    if (confere) {
      bancoEstoque.registrarCompra(id, i.itens.map((x) => ({ produtoId: x.produtoId, quantidade: x.quantidade })), usuario)
      this.mudar(i, 'RECEBIDA')
      this.evento(i, 'RECEBIDA', usuario, `Recebimento conferido: ${i.itens.map((x) => `${x.quantidade} × ${x.produtoNome}`).join(', ')}. Estoque atualizado.`)
    } else {
      i.divergencia = t
      this.mudar(i, 'DIVERGENTE')
      this.evento(i, 'DIVERGENTE', usuario, `Recebimento divergente: ${i.itens.map((x) => `${x.produtoNome} ${x.quantidadeRecebida} de ${x.quantidade}`).join(', ')}. ${t}`)
    }
    return { id, status: i.status, lancamentoId: null, avisos: [] }
  }

  // US-EXPENSE-007

  corrigir(id: number, itens: ItemQuantidade[], valor: number | null, motivo: string, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    this.exigir(i, 'DIVERGENTE')
    const erros: ErroCampo[] = []
    const acordadas = new Map(itens.map((x) => [x.produtoId, x.quantidade]))
    const mudancas: string[] = []
    const corrigidos: ItemCompra[] = []
    for (const item of i.itens) {
      const q = acordadas.get(item.produtoId)
      if (q === undefined || q === null || !Number.isInteger(q) || q < 0) {
        erros.push({ campo: `itens[${item.produtoId}]`, mensagem: `Informe a quantidade acordada de ${item.produtoNome} (zero para tirar o item).` })
        continue
      }
      if (q !== item.quantidade) mudancas.push(`${item.produtoNome} ${item.quantidade} → ${q}`)
      if (q > 0) corrigidos.push({ ...item, quantidade: q, quantidadeRecebida: null })
    }
    if (erros.length === 0 && corrigidos.length === 0) erros.push({ campo: 'itens', mensagem: 'A compra precisa de ao menos um item. Para desistir, cancele a compra.' })
    const atual = i.aprovacao!.valor
    const novo = valor ?? atual
    exigirValor(novo, 'valor', erros)
    const t = texto(motivo, 'motivo', 'Informe o motivo da correção.', erros)
    validacao(erros)
    const mudou = centavos(novo) !== centavos(atual)
    let lancamentoId: number | null = null
    let avisos: string[] = []
    if (mudou) {
      mudancas.push(`valor ${brl(atual)} → ${brl(novo)}`)
      const anterior = i.aprovacao!.lancamentoId!
      if (!bancoFinanceiro.estornado(anterior)) bancoFinanceiro.estornarPorId(anterior, `Estorno: intenção de gasto nº ${id} (correção)`, t, usuario)
      i.aprovacao!.valor = novo
      const r = this.lancarDespesa(i, usuario)
      lancamentoId = r.lancamentoId
      avisos = r.avisos
    }
    i.itens = corrigidos
    i.divergencia = null
    i.recebidaPorNome = null
    i.recebidaEm = null
    this.mudar(i, 'AGUARDANDO_RECEBIMENTO')
    this.evento(
      i,
      'CORRIGIDA',
      usuario,
      `Corrigida${mudancas.length ? `: ${mudancas.join('; ')}` : ''}. Motivo: ${t}${mudou ? ' Despesa estornada e lançada com o novo valor.' : ''}`,
    )
    return { id, status: i.status, lancamentoId, avisos }
  }

  cancelarDivergente(id: number, motivo: string, usuario: Usuario): ResultadoAcao {
    const i = this.obter(id)
    this.exigir(i, 'DIVERGENTE')
    const erros: ErroCampo[] = []
    const t = texto(motivo, 'motivo', 'Informe o motivo do cancelamento.', erros)
    validacao(erros)
    const lancamento = i.aprovacao!.lancamentoId!
    const ja = bancoFinanceiro.estornado(lancamento)
    if (!ja) bancoFinanceiro.estornarPorId(lancamento, `Estorno: intenção de gasto nº ${id} (compra cancelada)`, t, usuario)
    this.cancelar(i, t, usuario)
    this.evento(i, 'CANCELADA', usuario, `Compra cancelada após divergência: ${t}${ja ? ' A despesa já havia sido estornada no Financeiro.' : ' Despesa estornada.'}`)
    return { id, status: i.status, lancamentoId: null, avisos: [] }
  }
}

export const bancoIntencoes = new BancoIntencoes()
