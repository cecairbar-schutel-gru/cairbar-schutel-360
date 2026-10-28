import type { OrigemObrigacao, StatusObrigacao } from '../features/editoras/types'
import { hoje } from '../shared/formatters/datas'

/**
 * Dados simulados do módulo Editoras compartilhados com Estoque e Vendas: editoras, remessas e as
 * obrigações criadas pelas vendas e baixas de consignados. Não importa outros bancos, para que
 * Estoque e Vendas o usem sem dependência circular.
 */

export interface EditoraMock {
  id: number
  nome: string
  cnpj: string | null
  contatoNome: string | null
  telefone: string | null
  email: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  chavePix: string | null
  observacoes: string | null
  ativa: boolean
}

export interface ItemRemessaMock {
  produtoId: number
  quantidade: number
  repasse: number
}

export interface RemessaMock {
  id: number
  codigo: string
  editoraId: number
  recebidaEm: string
  numeroDocumento: string | null
  status: 'ABERTA' | 'CANCELADA'
  itens: ItemRemessaMock[]
  /** Percentual de repasse por título. */
  repasse: Record<number, number>
  registradaEm: string | null
  registradaPor: string | null
  canceladaEm: string | null
  canceladaPor: string | null
  motivoCancelamento: string | null
}

export interface ObrigacaoMock {
  id: number
  editoraId: number
  remessaId: number
  produtoId: number
  origem: OrigemObrigacao
  origemId: number
  origemNumero: number
  quantidade: number
  precoUnitario: number
  repassePercentual: number
  valor: number
  valorPago: number
  status: StatusObrigacao
  criadaEm: string
  estornadaEm: string | null
}

/** Valor já pago de obrigação estornada; negativo quando o pagamento é estornado depois. */
export interface CreditoMock {
  editoraId: number
  obrigacaoId: number
  valor: number
}

const editora = (id: number, nome: string, cnpj: string, extra: Partial<EditoraMock> = {}): EditoraMock => ({
  id,
  nome,
  cnpj,
  contatoNome: null,
  telefone: null,
  email: null,
  banco: null,
  agencia: null,
  conta: null,
  chavePix: null,
  observacoes: null,
  ativa: true,
  ...extra,
})

const remessa = (id: number, codigo: string, recebidaEm: string, itens: ItemRemessaMock[]): RemessaMock => ({
  id,
  codigo,
  editoraId: 1,
  recebidaEm,
  numeroDocumento: null,
  status: 'ABERTA',
  itens,
  repasse: Object.fromEntries(itens.map((i) => [i.produtoId, i.repasse])),
  registradaEm: `${recebidaEm}T13:00:00.000Z`,
  registradaPor: 'Daniel Administrador',
  canceladaEm: null,
  canceladaPor: null,
  motivoCancelamento: null,
})

const editorasIniciais = (): EditoraMock[] => [
  editora(1, 'Editora Luz', '33445566000186', {
    contatoNome: 'Marta Souza',
    telefone: '11987654321',
    email: 'contato@editoraluz.com.br',
    chavePix: 'financeiro@editoraluz.com.br',
  }),
  editora(2, 'FEB Editora', '98765432000198', { banco: 'Banco do Brasil', agencia: '1234', conta: '56789-0' }),
]

// Exemplo da US-SALES-006: R-0001 (01/09/2026, 40%) com 3 unidades e R-0002 (10/10/2026, 35%) com 5.
const remessasIniciais = (): RemessaMock[] => [
  remessa(1, 'R-0001', '2026-09-01', [{ produtoId: 1, quantidade: 3, repasse: 40 }]),
  remessa(2, 'R-0002', '2026-10-10', [{ produtoId: 1, quantidade: 5, repasse: 35 }]),
]

export const EDITORAS: EditoraMock[] = editorasIniciais()
export const REMESSAS: RemessaMock[] = remessasIniciais()
export const OBRIGACOES: ObrigacaoMock[] = []
export const CREDITOS: CreditoMock[] = []
let proximaObrigacao = 1

/** Volta ao estado inicial mantendo as mesmas referências dos arrays (importados por outros bancos). */
export function reiniciarCadastroEditoras(): void {
  EDITORAS.splice(0, EDITORAS.length, ...editorasIniciais())
  REMESSAS.splice(0, REMESSAS.length, ...remessasIniciais())
  OBRIGACOES.length = 0
  CREDITOS.length = 0
  proximaObrigacao = 1
}

/** Preço cobrado × quantidade × percentual da remessa, arredondado ao centavo. */
export function valorObrigacao(precoUnitario: number, quantidade: number, percentual: number): number {
  return Math.round((Math.round(precoUnitario * 100) * quantidade * percentual) / 100) / 100
}

export function registrarObrigacao(dados: {
  remessa: RemessaMock
  produtoId: number
  origem: OrigemObrigacao
  origemId: number
  origemNumero: number
  quantidade: number
  precoUnitario: number
}): ObrigacaoMock {
  const percentual = dados.remessa.repasse[dados.produtoId] ?? 0
  const o: ObrigacaoMock = {
    id: proximaObrigacao++,
    editoraId: dados.remessa.editoraId,
    remessaId: dados.remessa.id,
    produtoId: dados.produtoId,
    origem: dados.origem,
    origemId: dados.origemId,
    origemNumero: dados.origemNumero,
    quantidade: dados.quantidade,
    precoUnitario: dados.precoUnitario,
    repassePercentual: percentual,
    valor: valorObrigacao(dados.precoUnitario, dados.quantidade, percentual),
    valorPago: 0,
    status: 'ABERTA',
    criadaEm: hoje().toISOString(),
    estornadaEm: null,
  }
  OBRIGACOES.push(o)
  return o
}

/** Cancelamento da venda: o que já tinha sido pago vira crédito da editora. */
export function estornarObrigacoesDaVenda(vendaId: number): void {
  for (const o of OBRIGACOES.filter((x) => x.origem === 'VENDA' && x.origemId === vendaId && x.status !== 'ESTORNADA')) {
    o.status = 'ESTORNADA'
    o.estornadaEm = hoje().toISOString()
    if (o.valorPago > 0) CREDITOS.push({ editoraId: o.editoraId, obrigacaoId: o.id, valor: o.valorPago })
  }
}
