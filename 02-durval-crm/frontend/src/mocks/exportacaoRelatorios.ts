import type { Usuario } from '../auth'
import type { FiltroLancamentos, NaturezaLancamento, OrigemLancamento, TipoConta } from '../features/financeiro/types'
import { ROTULO_MEIO_RELATORIO, type Agrupamento, type FormatoExportacao, type GrupoCategoria, type TipoExportacao } from '../features/relatorios/types'
import { formatarData, formatarDataHora, hoje } from '../shared/formatters/datas'
import { formatarMoeda } from '../shared/formatters/formatadores'
import { bancoConciliacoes } from './bancoConciliacoes'
import { bancoEditoras } from './bancoEditoras'
import { bancoFechamento } from './bancoFechamento'
import { bancoFinanceiro, CONTAS, ORGANIZACAO } from './bancoFinanceiro'
import { bancoRelatorios } from './bancoRelatorios'
import { ErroNegocio } from './erroNegocio'
import { pdfPaginas } from './pdfSimples'
import { planilhaSimples, type CelulaPlanilha } from './planilhaSimples'

/** Seção do documento exportado: valores crus (números como números), como no backend. */
interface Secao {
  titulo: string
  colunas: string[]
  /** Colunas monetárias (formatadas como R$ no PDF). */
  moeda?: number[]
  linhas: CelulaPlanilha[][]
  total?: CelulaPlanilha[]
}

interface Documento {
  titulo: string
  arquivo: string
  periodo: string
  filtros: [string, string][]
  secoes: Secao[]
}

const TIPOS = { PDF: 'application/pdf', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
const periodoBr = (de: string | null, ate: string) => (de && de !== ate ? `${formatarData(de)} a ${formatarData(ate)}` : formatarData(ate))
const mesBr = (mes: string | null) => (mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : '')
const ROTULO_TIPO: Record<TipoConta, string> = { CAIXA: 'Caixas', BANCO: 'Bancos', CARTAO_A_RECEBER: 'Cartão a receber' }
const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = { DIA: 'Por dia', SEMANA: 'Por semana', MES: 'Por mês' }

function categorias(titulo: string, grupos: GrupoCategoria[], total: number): Secao {
  return {
    titulo,
    colunas: ['Categoria', 'Subcategoria', 'Valor', '% do total'],
    moeda: [2],
    linhas: grupos.flatMap((g) => [
      [g.nome, null, g.valor, g.percentual] as CelulaPlanilha[],
      ...g.subcategorias.map((s) => [g.nome, s.nome + (s.ativa ? '' : ' (inativa)'), s.valor, s.percentual]),
    ]),
    total: ['Total', null, total, grupos.length > 0 ? 100 : null],
  }
}

/** Monta o documento com os mesmos filtros da tela (US-REPORT-021). */
function documento(tipo: TipoExportacao, q: URLSearchParams, usuario: Usuario): Documento {
  const p = (k: string) => q.get(k) || undefined
  const n = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined)
  switch (tipo) {
    case 'fluxo-caixa': {
      const f = bancoRelatorios.fluxoCaixa({ de: p('de'), ate: p('ate'), agrupamento: p('agrupamento') as Agrupamento | undefined, contaId: n('contaId'), tipoConta: p('tipoConta') as TipoConta | undefined })
      const contas = f.contaId ? f.contas[0].nome : f.tipoConta ? ROTULO_TIPO[f.tipoConta] : 'Todas as contas'
      return {
        titulo: 'Fluxo de caixa',
        arquivo: `fluxo-de-caixa-${f.de}-a-${f.ate}`,
        periodo: periodoBr(f.de, f.ate),
        filtros: [['Contas', contas], ['Agrupamento', ROTULO_AGRUPAMENTO[f.agrupamento]]],
        secoes: [
          {
            titulo: 'Resumo',
            colunas: ['Item', 'Valor'],
            moeda: [1],
            linhas: [['Saldo inicial', f.saldoInicial], ['Entradas', f.totalEntradas], ['Saídas', f.totalSaidas], ['Transferências recebidas', f.transferenciasEntrada], ['Transferências enviadas', f.transferenciasSaida]],
            total: ['Saldo final', f.saldoFinal],
          },
          categorias('Entradas por categoria', f.entradas, f.totalEntradas),
          categorias('Saídas por categoria', f.saidas, f.totalSaidas),
          {
            titulo: 'Movimento por período',
            colunas: ['Início', 'Fim', 'Saldo inicial', 'Entradas', 'Saídas', 'Transf. recebidas', 'Transf. enviadas', 'Saldo final'],
            moeda: [2, 3, 4, 5, 6, 7],
            linhas: f.periodos.map((l) => [formatarData(l.inicio), formatarData(l.fim), l.saldoInicial, l.entradas, l.saidas, l.transferenciasEntrada, l.transferenciasSaida, l.saldoFinal]),
          },
        ],
      }
    }
    case 'receitas-despesas': {
      const r = bancoRelatorios.receitasDespesas({ de: p('de'), ate: p('ate') })
      return {
        titulo: 'Receitas e despesas por categoria',
        arquivo: `receitas-e-despesas-${r.de}-a-${r.ate}`,
        periodo: periodoBr(r.de, r.ate),
        filtros: [],
        secoes: [
          categorias('Receitas por categoria', r.receitas, r.totalReceitas),
          categorias('Despesas por categoria', r.despesas, r.totalDespesas),
          { titulo: 'Resultado', colunas: ['Item', 'Valor'], moeda: [1], linhas: [['Receitas', r.totalReceitas], ['Despesas', r.totalDespesas]], total: ['Resultado', r.resultado] },
          { titulo: 'Editoras', colunas: ['Item', 'Valor'], moeda: [1], linhas: [['Devido às editoras (saldo atual)', bancoEditoras.saldos().total]] },
        ],
      }
    }
    case 'saldos': {
      const s = bancoRelatorios.saldos({ de: p('de'), ate: p('ate'), data: p('data') })
      const naData = s.modo === 'DATA'
      const secoes: Secao[] = s.grupos.map((g) => ({
        titulo: ROTULO_TIPO[g.tipo],
        colunas: naData ? ['Conta', 'Saldo', 'Conciliada até'] : ['Conta', 'Saldo inicial', 'Entradas', 'Saídas', 'Transf. recebidas', 'Transf. enviadas', 'Saldo final', 'Conciliada até'],
        moeda: naData ? [1] : [1, 2, 3, 4, 5, 6],
        linhas: g.contas.map((c) =>
          naData
            ? [c.nome, c.saldoFinal, c.conciliadaAte ? formatarData(c.conciliadaAte) : null]
            : [c.nome, c.saldoInicial, c.entradas, c.saidas, c.transferenciasEntrada, c.transferenciasSaida, c.saldoFinal, c.conciliadaAte ? formatarData(c.conciliadaAte) : null],
        ),
        total: naData ? ['Total', g.totais.saldoFinal] : ['Total', g.totais.saldoInicial, g.totais.entradas, g.totais.saidas, g.totais.transferenciasEntrada, g.totais.transferenciasSaida, g.totais.saldoFinal],
      }))
      secoes.push({
        titulo: 'Posição',
        colunas: ['Item', 'Saldo'],
        moeda: [1],
        linhas: [['Disponível (caixas e bancos)', s.totalDisponivel.saldoFinal], ['Cartão a receber (a receber)', s.cartaoAReceber?.saldoFinal ?? 0]],
        total: ['Disponível + a receber', s.totalComRecebiveis],
      })
      return {
        titulo: 'Saldos por conta',
        arquivo: naData ? `saldos-em-${s.ate}` : `saldos-${s.de}-a-${s.ate}`,
        periodo: naData ? `Saldos no fim do dia ${formatarData(s.ate)}` : periodoBr(s.de, s.ate),
        filtros: [['Modo', naData ? 'Saldo na data' : 'Período']],
        secoes,
      }
    }
    case 'mensalidades': {
      const m = bancoRelatorios.mensalidades({ competenciaDe: p('competenciaDe'), competenciaAte: p('competenciaAte'), de: p('de'), ate: p('ate') })
      const rec = (r: (typeof m)['recebimentos'], rotulo: string): CelulaPlanilha[] => [rotulo, r.atrasadas.quantidade, r.atrasadas.valor, r.mesCorrente.quantidade, r.mesCorrente.valor, r.antecipadas.quantidade, r.antecipadas.valor, r.total.valor]
      return {
        titulo: 'Mensalidades',
        arquivo: `mensalidades-${m.de}-a-${m.ate}`,
        periodo: `Recebimentos de ${periodoBr(m.de, m.ate)}`,
        filtros: [['Competências', `${mesBr(m.competenciaDe)} a ${mesBr(m.competenciaAte)}`], ['Período de recebimento', periodoBr(m.de, m.ate)]],
        secoes: [
          {
            titulo: 'Competências por mês',
            colunas: ['Competência', 'Geradas', 'Pagas', 'Pendentes', 'Canceladas', 'Valor gerado', 'Valor pago', 'Valor pendente', 'Taxa de pagamento (%)'],
            moeda: [5, 6, 7],
            linhas: m.porCompetencia.map((s) => [mesBr(s.mes), s.geradas, s.pagas, s.pendentes, s.canceladas, s.valorGerado, s.valorPago, s.valorPendente, s.taxaPagamento]),
            total: ['Total', m.totalCompetencias.geradas, m.totalCompetencias.pagas, m.totalCompetencias.pendentes, m.totalCompetencias.canceladas, m.totalCompetencias.valorGerado, m.totalCompetencias.valorPago, m.totalCompetencias.valorPendente, m.totalCompetencias.taxaPagamento],
          },
          {
            titulo: 'Recebido em mensalidades',
            colunas: ['Mês do recebimento', 'Atrasadas (qtd.)', 'Atrasadas', 'Do mês (qtd.)', 'Do mês', 'Antecipadas (qtd.)', 'Antecipadas', 'Total'],
            moeda: [2, 4, 6, 7],
            linhas: m.recebimentosPorMes.map((r) => rec(r, mesBr(r.mes))),
            total: rec(m.recebimentos, 'Total'),
          },
          {
            titulo: 'Doadores com 3 ou mais competências pendentes',
            colunas: ['Doador', 'Pendentes', 'Valor pendente', 'Último pagamento'],
            moeda: [2],
            linhas: m.doadoresComPendencias.map((d) => [d.nome, d.pendentes, d.valorPendente, d.ultimoPagamento ? formatarData(d.ultimoPagamento) : null]),
          },
        ],
      }
    }
    case 'vendas': {
      const v = bancoRelatorios.vendas(usuario, { de: p('de'), ate: p('ate') })
      return {
        titulo: 'Vendas',
        arquivo: `vendas-${v.de}-a-${v.ate}`,
        periodo: periodoBr(v.de, v.ate),
        filtros: [],
        secoes: [
          {
            titulo: 'Totais',
            colunas: ['Item', 'Quantidade', 'Valor'],
            moeda: [2],
            linhas: [['Vendas no período', v.vendas, v.receitaBruta], ['Canceladas no período', v.canceladas, v.valorCancelado], ['Livros', null, v.livros], ['Cantina', null, v.cantina]],
            total: ['Receita líquida', null, v.receitaLiquida],
          },
          { titulo: 'Por forma de pagamento', colunas: ['Forma', 'Valor'], moeda: [1], linhas: v.porMeio.map((m) => [ROTULO_MEIO_RELATORIO[m.meio], m.valor]) },
          { titulo: 'Por produto', colunas: ['Produto', 'Tipo', 'Quantidade', 'Receita'], moeda: [3], linhas: v.porProduto.map((x) => [x.nome, x.tipo === 'LIVRO' ? 'Livro' : 'Cantina', x.quantidade, x.valor]) },
          {
            titulo: 'Por vendedor',
            colunas: ['Vendedor', 'Vendas', 'Bruto', 'Canceladas', 'Cancelado', 'Líquido'],
            moeda: [2, 4, 5],
            linhas: v.porVendedor.map((c) => [c.nome, c.vendas, c.bruto, c.canceladas, c.cancelado, c.liquido]),
            total: ['Total', v.vendas, v.receitaBruta, v.canceladas, v.valorCancelado, v.receitaLiquida],
          },
        ],
      }
    }
    case 'estoque': {
      const e = bancoRelatorios.estoque({ de: p('de'), ate: p('ate'), tipo: p('tipo') as 'LIVRO' | 'CANTINA' | undefined, categoria: p('categoria'), editoraId: n('editoraId'), somenteComMovimento: q.get('somenteComMovimento') === 'true' })
      const linha = (produto: string, origem: string | null, l: (typeof e)['total']): CelulaPlanilha[] => [produto, origem, l.inicial, l.compra, l.doacao, l.remessa, l.venda, l.devolucao, l.baixa, l.ajuste, l.fim]
      return {
        titulo: 'Estoque',
        arquivo: `estoque-${e.de}-a-${e.ate}`,
        periodo: periodoBr(e.de, e.ate),
        filtros: [['Tipo', e.tipo === 'LIVRO' ? 'Livros' : e.tipo === 'CANTINA' ? 'Cantina' : 'Todos'], ['Somente com movimento', e.somenteComMovimento ? 'Sim' : 'Não']],
        secoes: [
          {
            titulo: 'Saldos e movimentos por produto',
            colunas: ['Produto', 'Origem', 'Inicial', 'Compra', 'Doação', 'Remessa', 'Venda', 'Devolução', 'Baixa', 'Ajuste', 'Final'],
            linhas: e.produtos.flatMap((x) => x.origens.map((o) => linha(x.nome, o.origem === 'CONSIGNADO' ? `Consignado ${o.remessaCodigo ?? ''}` : 'Próprio', o))),
            total: linha('Total', null, e.total),
          },
          { titulo: 'Baixas por motivo', colunas: ['Motivo', 'Quantidade'], linhas: e.baixasPorMotivo.map((b) => [b.motivo, b.quantidade]) },
        ],
      }
    }
    case 'contagem-estoque': {
      const c = bancoRelatorios.contagem({ tipo: p('tipo') as 'LIVRO' | 'CANTINA' | undefined, categoria: p('categoria'), editoraId: n('editoraId') })
      return {
        titulo: 'Folha de contagem de estoque',
        arquivo: `contagem-estoque-${c.data}`,
        periodo: `Quantidades do sistema em ${formatarData(c.data)}`,
        filtros: [['Tipo', c.tipo === 'LIVRO' ? 'Livros' : c.tipo === 'CANTINA' ? 'Cantina' : 'Todos']],
        secoes: [{ titulo: 'Folha de contagem', colunas: ['Produto', 'Próprio', 'Consignado', 'No sistema', 'Contado'], linhas: c.itens.map((i) => [i.nome, i.proprio, i.consignado, i.quantidade, null]) }],
      }
    }
    case 'editoras': {
      const r = bancoRelatorios.editoras({ de: p('de'), ate: p('ate') })
      const linha = (a: (typeof r)['total']): CelulaPlanilha[] => [a.nome, a.saldoInicial, a.obrigacoesVendas, a.obrigacoesBaixas, a.estornos, a.pagamentos, a.saldoFinal, a.transferido]
      return {
        titulo: 'Acertos com editoras',
        arquivo: `acertos-editoras-${r.de}-a-${r.ate}`,
        periodo: periodoBr(r.de, r.ate),
        filtros: [],
        secoes: [{ titulo: 'Acertos por editora', colunas: ['Editora', 'Saldo inicial', 'Obrigações (vendas)', 'Obrigações (dano/extravio)', 'Estornos', 'Pagamentos', 'Saldo final', 'Transferido'], moeda: [1, 2, 3, 4, 5, 6, 7], linhas: r.editoras.map(linha), total: linha(r.total) }],
      }
    }
    case 'demonstrativo': {
      const d = bancoFechamento.demonstrativo(q.get('mes') ?? '', n('versao'))
      const comparada = (titulo: string, grupos: typeof d.receitas, total: typeof d.totalReceitas): Secao => ({
        titulo,
        colunas: ['Categoria', 'Mês', mesBr(d.mesAnterior), 'Diferença', 'Variação (%)'],
        moeda: [1, 2, 3],
        linhas: grupos.flatMap((g) => [
          [g.nome, g.valores.atual, g.valores.anterior, g.valores.diferenca, g.valores.percentual] as CelulaPlanilha[],
          ...g.subcategorias.map((s) => [`   ${s.nome}`, s.valores.atual, s.valores.anterior, s.valores.diferenca, s.valores.percentual]),
        ]),
        total: ['Total', total.atual, total.anterior, total.diferenca, total.percentual],
      })
      return {
        titulo: 'Prestação de contas — demonstrativo mensal',
        arquivo: `demonstrativo-${d.mes}`,
        periodo: `Mês ${mesBr(d.mes)}`,
        filtros: [['Situação', d.situacao === 'FECHADO' ? `Fechado (versão ${d.versao})` : 'Preliminar']],
        secoes: [
          comparada('Receitas por categoria', d.receitas, d.totalReceitas),
          comparada('Despesas por categoria', d.despesas, d.totalDespesas),
          {
            titulo: 'Saldos por conta',
            colunas: ['Conta', 'Saldo inicial', 'Entradas', 'Saídas', 'Transf. recebidas', 'Transf. enviadas', 'Saldo final'],
            moeda: [1, 2, 3, 4, 5, 6],
            linhas: d.contas.map((c) => [c.nome, c.saldoInicial, c.entradas, c.saidas, c.transferenciasEntrada, c.transferenciasSaida, c.saldoFinal]),
          },
        ],
      }
    }
    case 'apuracao-editora': {
      const a = bancoEditoras.apuracao(n('editoraId') ?? 0, q.get('mes') ?? '')
      return {
        titulo: `Apuração mensal — ${a.editora.nome}`,
        arquivo: `apuracao-editora-${a.editora.id}-${a.mes}`,
        periodo: `Mês ${mesBr(a.mes)}`,
        filtros: [['Editora', a.editora.nome]],
        secoes: [
          {
            titulo: 'Seção financeira',
            colunas: ['Item', 'Valor'],
            moeda: [1],
            linhas: [['Saldo inicial', a.saldoInicial], ['Obrigações por vendas', a.obrigacoesVendas], ['Obrigações por dano/extravio', a.obrigacoesBaixas], ['Estornos', a.estornos], ['Pagamentos', a.pagamentos]],
            total: ['Saldo final', a.saldoFinal],
          },
          {
            titulo: 'Estoque por remessa e título',
            colunas: ['Remessa', 'Título', 'Inicial', 'Recebida', 'Vendida', 'Devolvida', 'Baixada', 'Outros', 'Final'],
            linhas: a.estoque.map((e) => [e.remessaCodigo, e.titulo, e.inicial, e.recebida, e.vendida, e.devolvida, e.baixada, e.outros, e.fim]),
          },
        ],
      }
    }
    case 'conciliacao': {
      const s = bancoConciliacoes.sessao(n('id') ?? 0)
      const itens = (titulo: string, lista: typeof s.lancamentos): Secao => ({
        titulo,
        colunas: ['Data', 'Descrição', 'Valor'],
        moeda: [2],
        linhas: lista.map((i) => [formatarData(i.data), i.descricao, i.valor]),
      })
      return {
        titulo: `Conciliação bancária — ${s.contaNome}`,
        arquivo: `conciliacao-${s.id}`,
        periodo: `Até ${formatarData(s.dataFim)}`,
        filtros: [['Conta', s.contaNome]],
        secoes: [
          {
            titulo: 'Resumo',
            colunas: ['Item', 'Valor'],
            moeda: [1],
            linhas: [['Saldo conciliado anterior', s.saldoAbertura], ['Total marcado', s.totalMarcado], ['Saldo pelo sistema', s.saldoConciliado], ['Saldo do extrato', s.saldoExtrato]],
            total: ['Diferença', s.diferenca],
          },
          itens(s.concluidaEm ? 'Conciliados' : 'Lançamentos', s.lancamentos),
          itens('Pendentes', s.pendentes),
        ],
      }
    }
    case 'lancamentos': {
      const filtro: FiltroLancamentos = {
        contaId: n('contaId'),
        de: p('de'),
        ate: p('ate'),
        natureza: p('natureza') as NaturezaLancamento | undefined,
        categoria: p('categoria'),
        origem: p('origem') as OrigemLancamento | undefined,
        texto: p('texto'),
        valor: n('valor'),
      }
      const itens = []
      for (let pagina = 0; pagina < 200; pagina++) {
        const r = bancoFinanceiro.lancamentos(filtro, pagina)
        itens.push(...r.itens)
        if (!r.temMais) break
      }
      const conta = filtro.contaId ? CONTAS.find((c) => c.id === filtro.contaId)?.nome : undefined
      return {
        titulo: 'Lançamentos',
        arquivo: `lancamentos${filtro.de ? `-${filtro.de}` : ''}${filtro.ate ? `-a-${filtro.ate}` : ''}`,
        periodo: filtro.de || filtro.ate ? periodoBr(filtro.de ?? null, filtro.ate ?? '') : 'Todo o período',
        filtros: conta ? [['Conta', conta]] : [],
        secoes: [
          {
            titulo: 'Lançamentos',
            colunas: ['Data', 'Descrição', 'Categorias', 'Contas', 'Valor', 'Registrado por'],
            moeda: [4],
            linhas: itens.map((i) => [formatarData(i.data), i.descricao, i.categorias.join('; '), i.contas.join('; '), i.valor, i.usuario]),
          },
        ],
      }
    }
  }
}

function texto(v: CelulaPlanilha, moeda: boolean): string {
  if (v === null) return ''
  if (typeof v === 'number') return moeda ? formatarMoeda(v).replace(/ /g, ' ') : new Intl.NumberFormat('pt-BR').format(v)
  return v
}

function pdf(d: Documento, usuario: Usuario): Uint8Array {
  const linhas: string[] = [
    ORGANIZACAO.nome,
    d.titulo,
    `Período: ${d.periodo}`,
    `Gerado em ${formatarDataHora(hoje().toISOString())} por ${usuario.nome}`,
    ...(d.filtros.length > 0 ? [`Filtros: ${d.filtros.map(([r, v]) => `${r}: ${v}`).join(' · ')}`] : []),
    '',
  ]
  for (const s of d.secoes) {
    linhas.push(s.titulo, s.colunas.join(' | '))
    for (const l of [...s.linhas, ...(s.total ? [s.total] : [])]) linhas.push(l.map((v, i) => texto(v, s.moeda?.includes(i) ?? false)).join(' | '))
    linhas.push('')
  }
  const porPagina = 50
  const paginas: string[][] = []
  for (let i = 0; i < linhas.length; i += porPagina) paginas.push(linhas.slice(i, i + porPagina))
  const total = paginas.length
  // A4 paisagem, com o número da página no fim de cada uma.
  return pdfPaginas(paginas.map((p, i) => [...p, '', `Página ${i + 1} de ${total}`]), 842, 595, 8, 10)
}

function planilha(d: Documento, usuario: Usuario): Uint8Array {
  return planilhaSimples(
    d.secoes.map((s) => ({
      nome: s.titulo,
      linhas: [
        [ORGANIZACAO.nome],
        [`${d.titulo} — ${s.titulo}`],
        [`Período: ${d.periodo}`],
        [`Gerado em ${formatarDataHora(hoje().toISOString())} por ${usuario.nome}`],
        ...d.filtros.map(([r, v]) => [`${r}: ${v}`]),
        [],
        s.colunas,
        ...s.linhas,
        ...(s.total ? [s.total] : []),
      ],
    })),
  )
}

/** Exportação simulada (US-REPORT-021): o arquivo real é gerado pelo backend. */
export function exportarRelatorio(tipo: TipoExportacao, q: URLSearchParams, usuario: Usuario): { conteudo: Uint8Array; nome: string; tipoConteudo: string } {
  const formato = (q.get('formato') ?? '').toUpperCase() as FormatoExportacao
  if (formato !== 'PDF' && formato !== 'XLSX') {
    throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo: 'formato', mensagem: 'Escolha o formato: PDF ou XLSX.' }])
  }
  const d = documento(tipo, q, usuario)
  return {
    conteudo: formato === 'PDF' ? pdf(d, usuario) : planilha(d, usuario),
    nome: `${d.arquivo}.${formato.toLowerCase()}`,
    tipoConteudo: TIPOS[formato],
  }
}
