import type { Usuario } from '../auth'
import type {
  CanalAgradecimento,
  ContribuicaoRegistrada,
  HistoricoContribuicoes,
  ItemCompetencia,
  LayoutRecibo,
  MeioPagamento,
  NovaContribuicao,
  OpcoesPagamento,
  Pagamento,
  PainelCompetencias,
  PainelOperador,
  Recibo,
  SituacaoGeracao,
  StatusContribuicao,
  TipoContribuicao,
} from '../features/contribuicoes/types'
import { LIMITE_OBSERVACAO, MINIMO_MOTIVO_CANCELAMENTO, NOME_ANONIMO } from '../features/contribuicoes/types'
import { erroTipoCartao, rotuloPagamento } from '../shared/pagamento/regras'
import { formatarDataHora, hoje, paraIsoData } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import { bancoDoadores, type CompetenciaMock } from './bancoDoadores'
import { valorMensalidade } from './tabelaMensalidade'
import { bancoFinanceiro, CARTAO, CATEGORIA, ORGANIZACAO } from './bancoFinanceiro'
import { ErroNegocio } from './erroNegocio'
import { pdfSimples } from './pdfSimples'

interface ContribuicaoMock {
  id: number
  tipo: TipoContribuicao
  doadorId: number | null
  competencias: { mes: string; valor: number }[]
  valorDoacao: number
  pagamentos: Pagamento[]
  total: number
  observacao: string | null
  operadorId: string
  operadorNome: string
  recebidaEm: string
  data: string
  numeroRecibo: string
  chave: string
  status: StatusContribuicao
  canceladaEm: string | null
  motivoCancelamento: string | null
}

const validacao = (campo: string, mensagem: string) =>
  new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const centavos = (v: number) => Math.round(v * 100)
const duasCasas = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6
const brl = (v: number) => formatarMoeda(v).replace(/ /g, ' ')

function mesDe(data: Date, deslocamento = 0): string {
  const d = new Date(data.getFullYear(), data.getMonth() + deslocamento, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatarMes(mes: string): string {
  return `${mes.slice(5, 7)}/${mes.slice(0, 4)}`
}

/** Espelho simulado do módulo Contribuições do backend (mesmas regras e mensagens). */
class BancoContribuicoes {
  private contribuicoes: ContribuicaoMock[] = []
  private sequencia = new Map<number, number>()
  private proximoId = 1
  readonly mensagensPreparadas: { contribuicaoId: number; canal: CanalAgradecimento; em: string }[] = []

  reiniciar(): void {
    this.contribuicoes = []
    this.sequencia.clear()
    this.mensagensPreparadas.length = 0
    this.proximoId = 1
  }

  private obter(id: number): ContribuicaoMock {
    const c = this.contribuicoes.find((x) => x.id === id)
    if (!c) throw new ErroNegocio(404, 'CONTRIBUICAO_NAO_ENCONTRADA', 'Contribuição não encontrada.')
    return c
  }

  private nomeDoDoador(c: ContribuicaoMock): string {
    return c.doadorId === null ? NOME_ANONIMO : bancoDoadores.doadorDe(c.doadorId).nome
  }

  saldo(contaId: number): number {
    return bancoFinanceiro.saldo(contaId)
  }

  /** Simula a liquidação do cartão (US-FINANCIAL-004) nos testes. */
  liquidarCartao(valor: number): void {
    bancoFinanceiro.liquidarParaTeste(valor)
  }

  /** Contas de recebimento definidas pelo Administrador (US-CONTRIB-004). */
  opcoes(): OpcoesPagamento {
    const { dinheiro, pix, cartao } = bancoFinanceiro.contasRecebimento()
    const conta = (c: { id: number; nome: string } | null) => (c ? { id: c.id, nome: c.nome } : null)
    return { dinheiro: conta(dinheiro), pix: conta(pix), cartaoAReceber: { id: cartao.id, nome: cartao.nome } }
  }

  // US-CONTRIB-002
  painel(doadorId: number, completo: boolean): PainelCompetencias {
    const doador = bancoDoadores.doadorDe(doadorId)
    const gravadas = bancoDoadores.competenciasDe(doadorId)
    const atual = mesDe(hoje())
    const inicioHistorico = mesDe(hoje(), -23)
    const itens: ItemCompetencia[] = []
    let maisAntigas = false
    for (const c of gravadas) {
      if (c.status === 'PENDENTE' || completo || c.competencia >= inicioHistorico) {
        itens.push({
          competencia: c.competencia,
          valor: c.valor,
          situacao: c.status,
          atrasada: c.status === 'PENDENTE' && c.competencia < atual,
          selecionavel: c.status === 'PENDENTE',
          dataPagamento: c.dataPagamento,
          numeroRecibo: c.numeroRecibo,
          contribuicaoId: c.contribuicaoId ?? null,
        })
      } else {
        maisAntigas = true
      }
    }
    if (doador.status === 'ATIVO') {
      for (let i = 0; i <= 12; i++) {
        const mes = mesDe(hoje(), i)
        if (!gravadas.some((c) => c.competencia === mes)) {
          itens.push({
            competencia: mes,
            valor: valorMensalidade(mes),
            situacao: 'FUTURA',
            atrasada: false,
            selecionavel: true,
            dataPagamento: null,
            numeroRecibo: null,
            contribuicaoId: null,
          })
        }
      }
    }
    itens.sort((a, b) => a.competencia.localeCompare(b.competencia))
    const pendentes = gravadas.filter((c) => c.status === 'PENDENTE')
    return {
      quantidadePendentes: pendentes.length,
      totalPendente: pendentes.reduce((s, c) => s + centavos(c.valor), 0) / 100,
      mensalidadeAtual: valorMensalidade(paraIsoData(hoje()).slice(0, 7)),
      itens,
      possuiMaisAntigas: maisAntigas,
    }
  }

  // US-CONTRIB-004/006/007/008
  registrar(dados: NovaContribuicao, usuario: Usuario): ContribuicaoRegistrada {
    const repetida = this.contribuicoes.find((c) => c.chave === dados.chaveIdempotencia)
    if (repetida) return this.registrada(repetida)

    if (!dados.anonima && !usuario.papeis.includes('operador')) {
      throw new ErroNegocio(
        409,
        'SOMENTE_DOACAO_ANONIMA',
        'Seu perfil recebe só doações anônimas; mensalidades e doações de doadores ficam com o Operador.',
      )
    }
    if (!dados.anonima) {
      if (dados.doadorId === null) throw validacao('doadorId', 'Informe o doador.')
      if (bancoDoadores.doadorDe(dados.doadorId).status === 'ANONIMIZADO') {
        throw new ErroNegocio(409, 'DOADOR_ANONIMIZADO', 'Doador anonimizado não recebe contribuições.')
      }
    } else if (dados.doadorId !== null || dados.competencias.length > 0) {
      throw validacao('doadorId', 'Doação anônima não se vincula a doador nem a competência.')
    }

    const pagamentos: Pagamento[] = dados.pagamentos.map((p) => {
      const conta = bancoFinanceiro.contaDeRecebimento(p.meio)
      return { meio: p.meio, contaId: conta.id, contaNome: conta.nome, valor: p.valor, tipoCartao: p.tipoCartao ?? null }
    })
    const tipo = erroTipoCartao(pagamentos)
    if (tipo) throw validacao('tipoCartao', tipo)
    if (pagamentos.length === 0) throw validacao('pagamentos', 'Informe o valor recebido em ao menos um meio de pagamento.')
    if (pagamentos.some((p) => p.valor <= 0 || !duasCasas(p.valor))) {
      throw validacao('pagamentos', 'Os valores devem ser positivos, com até duas casas decimais.')
    }
    if ((dados.observacao ?? '').trim().length > LIMITE_OBSERVACAO) {
      throw validacao('observacao', `A observação deve ter até ${LIMITE_OBSERVACAO} caracteres.`)
    }

    const atual = mesDe(hoje())
    const limite = mesDe(hoje(), 12)
    const escolhidas: { mes: string; gravada: CompetenciaMock | null; valor: number }[] = []
    if (dados.doadorId !== null) {
      const doador = bancoDoadores.doadorDe(dados.doadorId)
      for (const mes of [...new Set(dados.competencias)].sort()) {
        const gravada = bancoDoadores.competenciasDe(dados.doadorId).find((c) => c.competencia === mes) ?? null
        if (gravada?.status === 'PAGA') throw new ErroNegocio(409, 'COMPETENCIA_JA_PAGA', 'Esta competência acabou de ser paga.')
        if (gravada?.status === 'CANCELADA') {
          throw new ErroNegocio(409, 'COMPETENCIA_CANCELADA', `A competência ${formatarMes(mes)} está cancelada e não pode ser paga.`)
        }
        if (!gravada && (doador.status !== 'ATIVO' || mes < atual || mes > limite)) {
          throw validacao('competencias', `A competência ${formatarMes(mes)} não está disponível para pagamento.`)
        }
        escolhidas.push({ mes, gravada, valor: gravada?.valor ?? valorMensalidade(mes) })
      }
    }

    const recebido = pagamentos.reduce((s, p) => s + centavos(p.valor), 0)
    const devido = escolhidas.reduce((s, e) => s + centavos(e.valor), 0)
    const doacao = centavos(dados.valorDoacao)
    const excedente = recebido - devido
    if (excedente < 0) {
      throw validacao('pagamentos', `Faltam ${brl(-excedente / 100)} no valor recebido. Remova uma competência ou ajuste os valores.`)
    }
    if (excedente > doacao) {
      throw validacao(
        'valorDoacao',
        `Há ${brl((excedente - doacao) / 100)} de excedente sem classificação. Classifique-o como doação extraordinária ou corrija os valores.`,
      )
    }
    if (excedente < doacao) throw validacao('valorDoacao', `A doação informada é maior que o excedente de ${brl(excedente / 100)}.`)

    const agora = hoje()
    const ano = agora.getFullYear()
    const numero = (this.sequencia.get(ano) ?? 0) + 1
    this.sequencia.set(ano, numero)
    const c: ContribuicaoMock = {
      id: this.proximoId++,
      tipo: dados.anonima ? 'DOACAO_ANONIMA' : escolhidas.length > 0 ? 'MENSALIDADE' : 'DOACAO_EXTRAORDINARIA',
      doadorId: dados.anonima ? null : dados.doadorId,
      competencias: escolhidas.map(({ mes, valor }) => ({ mes, valor })),
      valorDoacao: dados.valorDoacao,
      pagamentos,
      total: recebido / 100,
      observacao: dados.observacao?.trim() || null,
      operadorId: usuario.id,
      operadorNome: usuario.nome,
      recebidaEm: agora.toISOString(),
      data: paraIsoData(agora),
      numeroRecibo: `${ano}-${String(numero).padStart(6, '0')}`,
      chave: dados.chaveIdempotencia,
      status: 'REGISTRADA',
      canceladaEm: null,
      motivoCancelamento: null,
    }
    for (const e of escolhidas) {
      const paga = { status: 'PAGA' as const, dataPagamento: c.data, numeroRecibo: c.numeroRecibo, contribuicaoId: c.id }
      if (e.gravada) Object.assign(e.gravada, paga)
      else bancoDoadores.competenciasDe(c.doadorId!).push({ competencia: e.mes, valor: e.valor, ...paga, criadaNoPagamento: true })
    }
    const mensalidades = c.competencias.reduce((s, e) => s + centavos(e.valor), 0) / 100
    bancoFinanceiro.registrar(
      {
        data: c.data,
        origemTipo: 'CONTRIBUICAO',
        origemId: c.id,
        descricao: `Contribuição — recibo nº ${c.numeroRecibo}`,
        contas: pagamentos.map((p) => ({ contaId: p.contaId, valor: p.valor, tipoCartao: p.tipoCartao })),
        categorias: [
          { categoria: CATEGORIA.MENSALIDADES, valor: mensalidades },
          { categoria: c.tipo === 'DOACAO_ANONIMA' ? CATEGORIA.DOACOES_ANONIMAS : CATEGORIA.DOACOES_EXTRAORDINARIAS, valor: c.valorDoacao },
        ],
      },
      usuario,
    )
    this.contribuicoes.push(c)
    return this.registrada(c)
  }

  private registrada(c: ContribuicaoMock): ContribuicaoRegistrada {
    return { id: c.id, numeroRecibo: c.numeroRecibo, tipo: c.tipo, total: c.total, status: c.status }
  }

  /** O Vendedor (sem outro papel com acesso aos recibos) vê só as doações que registrou. */
  exigirVisivel(id: number, usuario: Usuario): void {
    const soVendedor = !usuario.papeis.some((p) => p === 'operador' || p === 'tesoureiro' || p === 'administrador')
    if (soVendedor && this.obter(id).operadorId !== usuario.id) {
      throw new ErroNegocio(404, 'CONTRIBUICAO_NAO_ENCONTRADA', 'Contribuição não encontrada.')
    }
  }

  // US-CONTRIB-009
  recibo(id: number, segundaVia: boolean): Recibo {
    const c = this.obter(id)
    return {
      contribuicaoId: c.id,
      numero: c.numeroRecibo,
      recebidaEm: c.recebidaEm,
      tipo: c.tipo,
      doadorId: c.doadorId,
      doadorNome: this.nomeDoDoador(c),
      competencias: structuredClone(c.competencias),
      valorDoacao: c.valorDoacao,
      pagamentos: structuredClone(c.pagamentos),
      total: c.total,
      observacao: c.observacao,
      operadorNome: c.operadorNome,
      status: c.status,
      canceladaEm: c.canceladaEm,
      motivoCancelamento: c.motivoCancelamento,
      segundaVia,
      organizacao: { ...ORGANIZACAO },
    }
  }

  pdf(id: number, layout: LayoutRecibo, segundaVia: boolean): { conteudo: Uint8Array; nome: string } {
    const r = this.recibo(id, segundaVia)
    const linhas = [
      r.organizacao.nome,
      `Recibo de contribuicao n. ${r.numero}${segundaVia ? ' (2a via)' : ''}`,
      `Data/hora: ${formatarDataHora(r.recebidaEm)}`,
      `Doador: ${r.doadorNome}`,
      ...r.competencias.map((c) => `Competencia ${formatarMes(c.mes)}: ${brl(c.valor)}`),
      ...(r.valorDoacao > 0 ? [`Doacao: ${brl(r.valorDoacao)}`] : []),
      ...r.pagamentos.map((p) => `${rotuloPagamento(p)} (${p.contaNome}): ${brl(p.valor)}`),
      `Total: ${brl(r.total)}`,
      `Operador: ${r.operadorNome}`,
      ...(r.status === 'CANCELADA' ? ['CANCELADO'] : []),
    ]
    return {
      conteudo: layout === 'A4' ? pdfSimples(linhas) : pdfSimples(linhas, 227, 60 + linhas.length * 16 + 40),
      nome: `recibo-${r.numero}${layout === 'TERMICA' ? '-80mm' : ''}.pdf`,
    }
  }

  localizarPorRecibo(numero: string, usuario: Usuario): { id: number } {
    const c = this.contribuicoes.find((x) => x.numeroRecibo === numero.trim())
    if (!c) throw new ErroNegocio(404, 'RECIBO_NAO_ENCONTRADO', 'Recibo não encontrado.')
    this.exigirVisivel(c.id, usuario)
    return { id: c.id }
  }

  // US-CONTRIB-010
  registrarMensagem(id: number, canal: CanalAgradecimento): void {
    const c = this.obter(id)
    if (c.doadorId === null) throw new ErroNegocio(409, 'DOACAO_ANONIMA', 'Doação anônima não tem mensagem de agradecimento.')
    this.mensagensPreparadas.push({ contribuicaoId: id, canal, em: hoje().toISOString() })
  }

  // US-CONTRIB-011
  cancelar(id: number, motivo: string, usuario: Usuario): ContribuicaoRegistrada {
    const c = this.obter(id)
    if (c.status === 'CANCELADA') throw new ErroNegocio(409, 'CONTRIBUICAO_JA_CANCELADA', 'Esta contribuição já foi cancelada.')
    if (motivo.trim().length < MINIMO_MOTIVO_CANCELAMENTO) {
      throw validacao('motivo', `Informe o motivo com pelo menos ${MINIMO_MOTIVO_CANCELAMENTO} caracteres.`)
    }
    const cartao = c.pagamentos.filter((p) => p.meio === 'CARTAO').reduce((s, p) => s + p.valor, 0)
    const saldo = bancoFinanceiro.saldo(CARTAO.id)
    if (cartao > 0 && cartao > saldo) {
      throw new ErroNegocio(
        409,
        'CARTAO_JA_LIQUIDADO',
        `A parte em cartão (${brl(cartao)}) é maior que o saldo atual de Cartão a receber (${brl(saldo)}), pois já foi liquidada. Registre uma despesa manual em vez de cancelar.`,
      )
    }
    // Primeiro o estorno: se ele for recusado (ex.: caixa ficaria negativo), nada muda.
    bancoFinanceiro.estornarOrigem('CONTRIBUICAO', c.id, `Estorno da contribuição — recibo nº ${c.numeroRecibo}`, usuario)
    if (c.doadorId !== null) {
      const lista = bancoDoadores.competenciasDe(c.doadorId)
      const atual = mesDe(hoje())
      for (const comp of [...lista]) {
        if (comp.contribuicaoId !== c.id) continue
        if (comp.criadaNoPagamento && comp.competencia > atual) lista.splice(lista.indexOf(comp), 1)
        else Object.assign(comp, { status: 'PENDENTE', dataPagamento: null, numeroRecibo: null, contribuicaoId: null, criadaNoPagamento: false })
      }
    }
    c.status = 'CANCELADA'
    c.canceladaEm = hoje().toISOString()
    c.motivoCancelamento = motivo.trim()
    return this.registrada(c)
  }

  // US-CONTRIB-012
  historico(doadorId: number, ano: number | null): HistoricoContribuicoes {
    bancoDoadores.doadorDe(doadorId)
    const escolhido = ano ?? hoje().getFullYear()
    const doDoador = this.contribuicoes.filter((c) => c.doadorId === doadorId)
    const anos = [...new Set([...doDoador.map((c) => Number(c.data.slice(0, 4))), escolhido])].sort((a, b) => b - a)
    const itens = doDoador
      .filter((c) => c.data.startsWith(String(escolhido)))
      .sort((a, b) => b.recebidaEm.localeCompare(a.recebidaEm) || b.id - a.id)
    return {
      ano: escolhido,
      anosDisponiveis: anos,
      totalNoAno: itens.filter((c) => c.status !== 'CANCELADA').reduce((s, c) => s + centavos(c.total), 0) / 100,
      itens: itens.map((c) => ({
        id: c.id,
        recebidaEm: c.recebidaEm,
        numeroRecibo: c.numeroRecibo,
        tipo: c.tipo,
        competencias: c.competencias.map((x) => x.mes),
        valorDoacao: c.valorDoacao,
        total: c.total,
        meios: [...new Set(c.pagamentos.map((p) => p.meio))].sort() as MeioPagamento[],
        status: c.status,
        motivoCancelamento: c.motivoCancelamento,
      })),
    }
  }

  // US-CONTRIB-021
  painelOperador(usuario: Usuario): PainelOperador {
    const data = paraIsoData(hoje())
    const doDia = this.contribuicoes.filter(
      (c) => c.data === data && c.status !== 'CANCELADA' && c.operadorId === usuario.id,
    )
    const soma = (lista: ContribuicaoMock[], meio: MeioPagamento) =>
      lista.flatMap((c) => c.pagamentos).filter((p) => p.meio === meio).reduce((s, p) => s + centavos(p.valor), 0) / 100
    return {
      data,
      quantidade: doDia.length,
      totalDinheiro: soma(doDia, 'DINHEIRO'),
      totalPix: soma(doDia, 'PIX'),
      totalCartao: soma(doDia, 'CARTAO'),
      ultimas: this.contribuicoes
        .filter((c) => c.operadorId === usuario.id)
        .sort((a, b) => b.recebidaEm.localeCompare(a.recebidaEm) || b.id - a.id)
        .slice(0, 10)
        .map((c) => ({
          id: c.id,
          recebidaEm: c.recebidaEm,
          numeroRecibo: c.numeroRecibo,
          tipo: c.tipo,
          doadorNome: this.nomeDoDoador(c),
          total: c.total,
          status: c.status,
        })),
    }
  }

  // US-CONTRIB-001: a geração do mês é feita pelo backend; aqui ela sempre está concluída.
  situacaoGeracao(): SituacaoGeracao {
    return { mes: mesDe(hoje()), estado: 'CONCLUIDA', tentativas: 1, ultimaTentativa: hoje().toISOString(), erro: null }
  }

  /** Todas as contribuições, para o relatório de mensalidades (US-REPORT-004). */
  todas(): readonly ContribuicaoMock[] {
    return this.contribuicoes
  }
}

export const bancoContribuicoes = new BancoContribuicoes()
