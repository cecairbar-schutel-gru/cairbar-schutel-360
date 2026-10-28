import type { Usuario } from '../auth'
import type {
  ContaParaConciliar,
  ExtratoDaSessao,
  ImportacaoExtrato,
  ItemConciliacao,
  LinhaDoExtrato,
  NovoLancamentoConciliacao,
  ParExtrato,
  ResumoConciliacao,
  SessaoConciliacao,
  StatusConciliacao,
} from '../features/conciliacao/types'
import { sugerirPares } from '../features/conciliacao/regras'
import type { ResultadoLancamento } from '../features/financeiro/types'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import {
  CONTAS,
  bancoFinanceiro,
  type LancamentoNaConta,
} from './bancoFinanceiro'
import { ErroNegocio } from './erroNegocio'
import { travaPeriodo } from './travaPeriodo'

interface Marcacao {
  lancamentoId: number
  valor: number
  marcadoPor: string
  marcadoEm: string
  adicionado: boolean
}

interface SessaoMock {
  id: number
  contaId: number
  dataFim: string
  saldoExtrato: number
  saldoAbertura: number
  status: StatusConciliacao
  iniciadaPor: string
  iniciadaEm: string
  concluidaPor: string | null
  concluidaEm: string | null
  marcacoes: Marcacao[]
  pendentes: number[]
  extrato:
    | (Omit<ExtratoDaSessao, 'linhas'> & {
        linhas: Omit<LinhaDoExtrato, 'sugestaoId'>[]
      })
    | null
}

const MAXIMO_LINHAS = 5000

const centavos = (v: number) => Math.round(v * 100)
const reais = (c: number) => c / 100
const dataBr = (iso: string) => iso.split('-').reverse().join('/')
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(v)
    .replace(/ /g, ' ')
const deslocar = (iso: string, dias: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return paraIsoData(new Date(a, m - 1, d + dias))
}
const diaAnterior = (iso: string) => deslocar(iso, -1)
const diaSeguinte = (iso: string) => deslocar(iso, 1)
const validacao = (campo: string, mensagem: string) =>
  new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const regra = (codigo: string, mensagem: string) =>
  new ErroNegocio(409, codigo, mensagem)

/** Espelho simulado do módulo Conciliação bancária do backend (US-RECONCILIATION-001 a 010). */
class BancoConciliacoes {
  private sessoes: SessaoMock[] = []
  private proximaLinha = 1

  reiniciar(): void {
    this.sessoes = []
    this.proximaLinha = 1
  }

  // US-RECONCILIATION-001

  contas(): ContaParaConciliar[] {
    return CONTAS.filter((c) => c.tipo === 'BANCO' && c.ativa)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((c) => {
        const ultima = this.ultimaConcluida(c.id)
        const andamento = this.emAndamento(c.id)
        return {
          contaId: c.id,
          contaNome: c.nome,
          banco: c.banco,
          agencia: c.agencia,
          numeroConta: c.numeroConta,
          dataCorte: c.dataCorte,
          conciliadaAte: ultima?.dataFim ?? null,
          saldoConciliado: ultima?.saldoExtrato ?? null,
          naoConciliados: bancoFinanceiro
            .naoConciliadosDaConta(c.id)
            .filter((l) => l.data >= c.dataCorte).length,
          sessaoId: andamento?.id ?? null,
          sessaoDataFim: andamento?.dataFim ?? null,
        }
      })
  }

  iniciar(
    usuario: Usuario,
    contaId: number,
    dataFim: string,
    saldoExtrato: number,
  ): SessaoConciliacao {
    const conta = CONTAS.find((c) => c.id === contaId)
    if (!conta)
      throw new ErroNegocio(
        404,
        'CONTA_NAO_ENCONTRADA',
        'Conta não encontrada.',
      )
    if (conta.tipo !== 'BANCO') {
      throw validacao(
        'contaId',
        'Só contas bancárias são conciliadas. Caixas são conferidos pela contagem do dinheiro e Cartão a receber, pela liquidação.',
      )
    }
    if (!conta.ativa)
      throw regra('CONTA_INATIVA', `A conta ${conta.nome} está inativa.`)
    if (this.emAndamento(contaId)) {
      throw regra(
        'CONCILIACAO_EM_ANDAMENTO',
        `Já existe uma conciliação em andamento para ${conta.nome}: continue-a.`,
      )
    }
    const anterior = this.ultimaConcluida(contaId)
    travaPeriodo.exigirAberto(dataFim)
    this.validarExtrato(contaId, dataFim, saldoExtrato)
    const sessao: SessaoMock = {
      id: this.sessoes.length + 1,
      contaId,
      dataFim,
      saldoExtrato,
      saldoAbertura: anterior ? anterior.saldoExtrato : conta.saldoInicial,
      status: 'EM_ANDAMENTO',
      iniciadaPor: usuario.nome,
      iniciadaEm: hoje().toISOString(),
      concluidaPor: null,
      concluidaEm: null,
      marcacoes: [],
      pendentes: [],
      extrato: null,
    }
    this.sessoes.push(sessao)
    return this.sessao(sessao.id)
  }

  // US-RECONCILIATION-003 e 010

  sessao(id: number): SessaoConciliacao {
    const s = this.sessaoMock(id)
    const conta = CONTAS.find((c) => c.id === s.contaId)!
    const emAndamento = s.status === 'EM_ANDAMENTO'
    const total = s.marcacoes.reduce((t, m) => t + centavos(m.valor), 0)
    const lancamentos = emAndamento
      ? this.candidatos(s).map((l) =>
          this.item(
            l,
            s.marcacoes.find((m) => m.lancamentoId === l.id),
          ),
        )
      : s.marcacoes
          .map((m) =>
            this.item(
              bancoFinanceiro.lancamentoNaConta(m.lancamentoId, s.contaId),
              m,
            ),
          )
          .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
    return {
      id: s.id,
      contaId: conta.id,
      contaNome: conta.nome,
      banco: conta.banco,
      agencia: conta.agencia,
      numeroConta: conta.numeroConta,
      dataFim: s.dataFim,
      dataFimAnterior: emAndamento
        ? (this.ultimaConcluida(s.contaId)?.dataFim ?? null)
        : null,
      saldoAbertura: s.saldoAbertura,
      totalMarcado: reais(total),
      saldoConciliado: reais(centavos(s.saldoAbertura) + total),
      saldoExtrato: s.saldoExtrato,
      diferenca: reais(
        centavos(s.saldoExtrato) - centavos(s.saldoAbertura) - total,
      ),
      status: s.status,
      iniciadaPor: s.iniciadaPor,
      iniciadaEm: s.iniciadaEm,
      concluidaPor: s.concluidaPor,
      concluidaEm: s.concluidaEm,
      lancamentos,
      pendentes: s.pendentes.map((id) =>
        this.item(bancoFinanceiro.lancamentoNaConta(id, s.contaId)),
      ),
      extrato:
        s.extrato &&
        this.extratoComSugestoes(s, emAndamento ? lancamentos : []),
    }
  }

  // Extrato importado (OFX ou CSV lido no navegador)

  importarExtrato(
    usuario: Usuario,
    id: number,
    d: ImportacaoExtrato,
  ): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    if (!d.arquivo?.trim())
      throw validacao('arquivo', 'Informe o nome do arquivo do extrato.')
    if (d.formato !== 'OFX' && d.formato !== 'CSV')
      throw validacao('formato', 'O extrato deve ser OFX ou CSV.')
    const linhas = d.linhas ?? []
    if (linhas.length === 0)
      throw validacao('linhas', 'O arquivo não tem movimentos.')
    if (linhas.length > MAXIMO_LINHAS)
      throw validacao(
        'linhas',
        `O extrato tem mais de ${MAXIMO_LINHAS} linhas: importe um período menor.`,
      )
    const erros = linhas.flatMap((l, i) =>
      !l.data
        ? [
            {
              campo: `linhas[${i}].data`,
              mensagem: `Linha ${i + 1}: data inválida.`,
            },
          ]
        : !l.valor
          ? [
              {
                campo: `linhas[${i}].valor`,
                mensagem: `Linha ${i + 1}: valor inválido.`,
              },
            ]
          : [],
    )
    if (erros.length > 0)
      throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
    const conta = CONTAS.find((c) => c.id === s.contaId)!
    const depoisDe =
      this.ultimaConcluida(s.contaId)?.dataFim ?? diaAnterior(conta.dataCorte)
    const noPeriodo = linhas.filter(
      (l) => l.data > depoisDe && l.data <= s.dataFim,
    )
    if (noPeriodo.length === 0) {
      throw validacao(
        'linhas',
        `Nenhuma linha do arquivo está no período desta conciliação (${dataBr(diaSeguinte(depoisDe))} a ${dataBr(s.dataFim)}).`,
      )
    }
    s.extrato = {
      arquivo: d.arquivo.trim(),
      formato: d.formato,
      importadoPor: usuario.nome,
      importadoEm: hoje().toISOString(),
      linhas: noPeriodo
        .map((l, ordem) => ({
          id: this.proximaLinha++,
          ordem,
          data: l.data,
          descricao:
            l.descricao.replace(/\s+/g, ' ').trim().slice(0, 255) ||
            '(sem descrição)',
          valor: reais(centavos(l.valor)),
          identificador: l.identificador?.trim() || null,
          lancamentoId: null,
          conferidaPor: null,
          conferidaEm: null,
        }))
        .sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem)
        .map(({ ordem: _ordem, ...l }) => l),
    }
    return this.sessao(id)
  }

  confirmarPares(
    usuario: Usuario,
    id: number,
    pares: ParExtrato[],
  ): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    if (!pares?.length)
      throw validacao('pares', 'Escolha ao menos um par para confirmar.')
    if (!s.extrato)
      throw regra(
        'EXTRATO_NAO_IMPORTADO',
        'Importe o extrato do banco antes de confirmar pares.',
      )
    const disponiveis = new Map(this.candidatos(s).map((l) => [l.id, l]))
    const ligados = new Set(
      s.extrato.linhas.map((l) => l.lancamentoId).filter((x) => x !== null),
    )
    const linhasDoPedido = new Set<number>()
    for (const p of pares) {
      const linha = s.extrato.linhas.find((l) => l.id === p.linhaId)
      if (!linha) {
        throw new ErroNegocio(
          404,
          'LINHA_EXTRATO_NAO_ENCONTRADA',
          'A linha do extrato não foi encontrada nesta conciliação: importe o extrato de novo.',
        )
      }
      if (linha.lancamentoId !== null || linhasDoPedido.has(linha.id)) {
        throw regra(
          'LINHA_EXTRATO_CONFERIDA',
          `A linha “${linha.descricao}” do extrato já tem um lançamento.`,
        )
      }
      linhasDoPedido.add(linha.id)
      if (!disponiveis.has(p.lancamentoId)) {
        throw regra(
          'LANCAMENTO_NAO_CONCILIAVEL',
          `O lançamento nº ${p.lancamentoId} não pode ser marcado: ele não é desta conta, já foi conciliado ou é posterior ao fim do extrato.`,
        )
      }
      if (ligados.has(p.lancamentoId)) {
        throw regra(
          'LANCAMENTO_JA_PAREADO',
          `O lançamento nº ${p.lancamentoId} já está ligado a outra linha do extrato.`,
        )
      }
      ligados.add(p.lancamentoId)
    }
    for (const p of pares) {
      this.marcarUm(s, disponiveis.get(p.lancamentoId)!, usuario, false)
      this.ligar(s, p.linhaId, p.lancamentoId, usuario)
    }
    return this.sessao(id)
  }

  desfazerPar(id: number, linhaId: number): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    const linha = s.extrato?.linhas.find(
      (l) => l.id === linhaId && l.lancamentoId !== null,
    )
    if (!linha)
      throw new ErroNegocio(
        404,
        'LINHA_EXTRATO_NAO_ENCONTRADA',
        'A linha do extrato não foi encontrada ou não tem lançamento.',
      )
    const lancamento = linha.lancamentoId
    Object.assign(linha, {
      lancamentoId: null,
      conferidaPor: null,
      conferidaEm: null,
    })
    s.marcacoes = s.marcacoes.filter((m) => m.lancamentoId !== lancamento)
    return this.sessao(id)
  }

  alterarExtrato(
    id: number,
    dataFim: string,
    saldoExtrato: number,
  ): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    travaPeriodo.exigirAberto(dataFim)
    this.validarExtrato(s.contaId, dataFim, saldoExtrato)
    s.dataFim = dataFim
    s.saldoExtrato = saldoExtrato
    s.marcacoes = s.marcacoes.filter(
      (m) =>
        bancoFinanceiro.lancamentoNaConta(m.lancamentoId, s.contaId).data <=
        dataFim,
    )
    this.desligarNaoMarcados(s)
    return this.sessao(id)
  }

  marcar(
    usuario: Usuario,
    id: number,
    ids: number[],
    marcado: boolean,
  ): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    if (ids.length === 0)
      throw validacao('lancamentoIds', 'Escolha ao menos um lançamento.')
    if (marcado) {
      const disponiveis = new Map(this.candidatos(s).map((l) => [l.id, l]))
      const fora = ids.find((x) => !disponiveis.has(x))
      if (fora !== undefined) {
        throw regra(
          'LANCAMENTO_NAO_CONCILIAVEL',
          `O lançamento nº ${fora} não pode ser marcado: ele não é desta conta, já foi conciliado ou é posterior ao fim do extrato.`,
        )
      }
      for (const x of ids) this.marcarUm(s, disponiveis.get(x)!, usuario, false)
    } else {
      s.marcacoes = s.marcacoes.filter((m) => !ids.includes(m.lancamentoId))
      this.desligarNaoMarcados(s)
    }
    return this.sessao(id)
  }

  // US-RECONCILIATION-005

  adicionarLancamento(
    usuario: Usuario,
    id: number,
    d: NovoLancamentoConciliacao,
  ): ResultadoLancamento {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    if (d.data && d.data > s.dataFim)
      throw validacao(
        'data',
        `Use uma data até o fim do extrato (${dataBr(s.dataFim)}).`,
      )
    if (d.linhaExtratoId !== undefined) {
      const linha = s.extrato?.linhas.find((l) => l.id === d.linhaExtratoId)
      if (!linha)
        throw new ErroNegocio(
          404,
          'LINHA_EXTRATO_NAO_ENCONTRADA',
          'A linha do extrato não foi encontrada nesta conciliação.',
        )
      if (linha.lancamentoId !== null)
        throw regra(
          'LINHA_EXTRATO_CONFERIDA',
          `A linha “${linha.descricao}” do extrato já tem um lançamento.`,
        )
    }
    let r: ResultadoLancamento
    if (d.tipo === 'TRANSFERENCIA') {
      if (!d.contraparteId)
        throw validacao(
          'contraparteId',
          'Escolha a outra conta da transferência.',
        )
      if (d.contraparteId === s.contaId)
        throw validacao(
          'contraparteId',
          'Escolha uma conta diferente da conciliada.',
        )
      const entrada = d.entrada !== false
      r = bancoFinanceiro.transferir(usuario, {
        contaOrigemId: entrada ? d.contraparteId : s.contaId,
        contaDestinoId: entrada ? s.contaId : d.contraparteId,
        valor: d.valor,
        data: d.data,
        descricao: d.descricao,
        chaveIdempotencia: d.chaveIdempotencia,
      })
    } else {
      r = bancoFinanceiro.lancarManual(usuario, {
        contaId: s.contaId,
        data: d.data,
        tipo: d.tipo,
        categoria: d.categoria ?? '',
        valor: d.valor,
        descricao: d.descricao,
        anexo: null,
        chaveIdempotencia: d.chaveIdempotencia,
      })
    }
    this.marcarUm(
      s,
      bancoFinanceiro.lancamentoNaConta(r.id, s.contaId),
      usuario,
      true,
    )
    if (d.linhaExtratoId !== undefined)
      this.ligar(s, d.linhaExtratoId, r.id, usuario)
    return r
  }

  // US-RECONCILIATION-007

  concluir(usuario: Usuario, id: number): SessaoConciliacao {
    const s = this.sessaoMock(id)
    this.exigirEmAndamento(s)
    travaPeriodo.exigirAberto(s.dataFim)
    const { diferenca } = this.sessao(id)
    if (centavos(diferenca) !== 0) {
      throw regra(
        'DIFERENCA_NAO_ZERADA',
        `A diferença é de ${brl(diferenca)}: a conciliação só é concluída quando o sistema bate com o extrato.`,
      )
    }
    const marcados = new Set(s.marcacoes.map((m) => m.lancamentoId))
    s.pendentes = this.candidatos(s)
      .filter((l) => !marcados.has(l.id))
      .map((l) => l.id)
    bancoFinanceiro.conciliar(s.id, s.contaId, [...marcados])
    s.status = 'CONCLUIDA'
    s.concluidaPor = usuario.nome
    s.concluidaEm = hoje().toISOString()
    return this.sessao(id)
  }

  historico(contaId?: number): ResumoConciliacao[] {
    return this.sessoes
      .filter(
        (s) => s.status === 'CONCLUIDA' && (!contaId || s.contaId === contaId),
      )
      .sort((a, b) => b.dataFim.localeCompare(a.dataFim) || b.id - a.id)
      .map((s) => ({
        id: s.id,
        contaId: s.contaId,
        contaNome: CONTAS.find((c) => c.id === s.contaId)?.nome ?? '—',
        dataFim: s.dataFim,
        saldoExtrato: s.saldoExtrato,
        conciliados: s.marcacoes.length,
        pendentes: s.pendentes.length,
        concluidaPor: s.concluidaPor!,
        concluidaEm: s.concluidaEm!,
      }))
  }

  /** Para o painel do Tesoureiro: data final da última conciliação por conta. */
  conciliadasAte(): Map<number, string> {
    const datas = new Map<number, string>()
    for (const s of this.sessoes.filter((x) => x.status === 'CONCLUIDA')) {
      const atual = datas.get(s.contaId)
      if (!atual || s.dataFim > atual) datas.set(s.contaId, s.dataFim)
    }
    return datas
  }

  private candidatos(s: SessaoMock): LancamentoNaConta[] {
    const corte = CONTAS.find((c) => c.id === s.contaId)!.dataCorte
    return bancoFinanceiro
      .naoConciliadosDaConta(s.contaId)
      .filter((l) => l.data >= corte && l.data <= s.dataFim)
  }

  private marcarUm(
    s: SessaoMock,
    l: LancamentoNaConta,
    usuario: Usuario,
    adicionado: boolean,
  ) {
    if (s.marcacoes.some((m) => m.lancamentoId === l.id)) return
    s.marcacoes.push({
      lancamentoId: l.id,
      valor: l.valor,
      marcadoPor: usuario.nome,
      marcadoEm: hoje().toISOString(),
      adicionado,
    })
  }

  private extratoComSugestoes(
    s: SessaoMock,
    candidatos: ItemConciliacao[],
  ): ExtratoDaSessao {
    const e = s.extrato!
    const ligados = new Set(e.linhas.map((l) => l.lancamentoId))
    const sugestoes = sugerirPares(
      e.linhas.filter((l) => l.lancamentoId === null && l.data <= s.dataFim),
      candidatos.filter((l) => !ligados.has(l.id)),
    )
    return {
      ...e,
      linhas: e.linhas.map((l) => ({
        ...l,
        sugestaoId: sugestoes.get(l.id) ?? null,
      })),
    }
  }

  private ligar(
    s: SessaoMock,
    linhaId: number,
    lancamentoId: number,
    usuario: Usuario,
  ) {
    const linha = s.extrato!.linhas.find((l) => l.id === linhaId)!
    Object.assign(linha, {
      lancamentoId,
      conferidaPor: usuario.nome,
      conferidaEm: hoje().toISOString(),
    })
  }

  private desligarNaoMarcados(s: SessaoMock) {
    const marcados = new Set(s.marcacoes.map((m) => m.lancamentoId))
    for (const l of s.extrato?.linhas ?? []) {
      if (l.lancamentoId !== null && !marcados.has(l.lancamentoId)) {
        Object.assign(l, {
          lancamentoId: null,
          conferidaPor: null,
          conferidaEm: null,
        })
      }
    }
  }

  private item(l: LancamentoNaConta, m?: Marcacao): ItemConciliacao {
    return {
      ...l,
      marcado: m !== undefined,
      marcadoPor: m?.marcadoPor ?? null,
      marcadoEm: m?.marcadoEm ?? null,
      adicionado: m?.adicionado ?? false,
    }
  }

  private validarExtrato(contaId: number, dataFim: string, saldo: number) {
    const conta = CONTAS.find((c) => c.id === contaId)!
    const anterior = this.ultimaConcluida(contaId)
    if (!dataFim) throw validacao('dataFim', 'Informe a data final do extrato.')
    const h = hoje()
    const ontem = paraIsoData(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1))
    if (dataFim > ontem)
      throw validacao('dataFim', `Use uma data até ontem (${dataBr(ontem)}): o extrato de hoje só fecha amanhã.`)
    if (anterior && dataFim <= anterior.dataFim) {
      throw validacao(
        'dataFim',
        `Use uma data posterior à última conciliação (${dataBr(anterior.dataFim)}).`,
      )
    }
    if (dataFim < conta.dataCorte)
      throw validacao(
        'dataFim',
        `A data é anterior à data de corte da conta (${dataBr(conta.dataCorte)}).`,
      )
    if (saldo === null || saldo === undefined || Number.isNaN(saldo))
      throw validacao('saldoExtrato', 'Informe o saldo final do extrato.')
  }

  private exigirEmAndamento(s: SessaoMock) {
    if (s.status !== 'EM_ANDAMENTO') {
      throw regra(
        'CONCILIACAO_CONCLUIDA',
        'Esta conciliação já foi concluída: os lançamentos conciliados não podem ser desmarcados. Corrija um erro por estorno.',
      )
    }
  }

  private emAndamento(contaId: number) {
    return this.sessoes.find(
      (s) => s.contaId === contaId && s.status === 'EM_ANDAMENTO',
    )
  }

  private ultimaConcluida(contaId: number) {
    return this.sessoes
      .filter((s) => s.contaId === contaId && s.status === 'CONCLUIDA')
      .sort((a, b) => b.dataFim.localeCompare(a.dataFim) || b.id - a.id)[0]
  }

  private sessaoMock(id: number): SessaoMock {
    const s = this.sessoes.find((x) => x.id === id)
    if (!s)
      throw new ErroNegocio(
        404,
        'CONCILIACAO_NAO_ENCONTRADA',
        'Conciliação não encontrada.',
      )
    return s
  }
}

export const bancoConciliacoes = new BancoConciliacoes()
