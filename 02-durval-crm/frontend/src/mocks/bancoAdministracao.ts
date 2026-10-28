import type { Papel, Usuario } from '../auth'
import { USUARIOS_SIMULADOS } from '../auth/usuariosSimulados'
import { deslocarMes } from '../features/editoras/regras'
import { erroChavePix, erroCidadePix, normalizarChavePix } from '../features/administracao/regras'
import type {
  CategoriaComSubcategorias,
  CategoriaPlano,
  DadosOrganizacao,
  DecisaoDuplicata,
  DuplicataLinha,
  EnvioImportacao,
  ErroLinha,
  EventoAuditoria,
  FiltroAuditoria,
  Importacao,
  ListaUsuarios,
  ModeloMensagem,
  NovaCategoria,
  NovoValorMensalidade,
  OpcoesAuditoria,
  Organizacao,
  PaginaAuditoria,
  PainelAdministrador,
  PreviaImportacao,
  SituacaoMensalidade,
  TextosModelo,
  TipoImportacao,
  TipoModelo,
  TotalImportacao,
  UsuarioIdentidade,
} from '../features/administracao/types'
import type { TipoCategoria } from '../features/financeiro/types'
import { MODELO_AGRADECIMENTO_PADRAO, MODELO_ANIVERSARIO_PADRAO } from '../shared/config/organizacao'
import { hoje, paraIsoData } from '../shared/formatters/datas'
import { apenasDigitos } from '../shared/formatters/formatadores'
import { normalizarTexto } from '../shared/text/texto'
import { validarCpf, validarEmail, validarTelefone } from '../shared/validators/validadores'
import { bancoDoadores, type DoadorImportadoMock } from './bancoDoadores'
import { bancoFechamento } from './bancoFechamento'
import { bancoFinanceiro, CATEGORIAS, CONTAS, ORGANIZACAO, type CategoriaPlanoMock } from './bancoFinanceiro'
import { ErroNegocio } from './erroNegocio'
import { reiniciarValoresMensalidade, VALORES_MENSALIDADE, valorMensalidade, type ValorMensalidadeMock } from './tabelaMensalidade'
import { travaPeriodo } from './travaPeriodo'

const VARIAVEIS: Record<TipoModelo, string[]> = {
  AGRADECIMENTO: ['nome', 'valor', 'competencias', 'data', 'recibo', 'organizacao'],
  ANIVERSARIO: ['nome', 'data', 'organizacao'],
}
const POR_PAGINA = 50
const validacao = (campo: string, mensagem: string) => new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])
const regra = (codigo: string, mensagem: string) => new ErroNegocio(409, codigo, mensagem)
const compactar = (t: string | null | undefined) => (t ?? '').trim().replace(/\s+/g, ' ')
const mesAtual = () => paraIsoData(hoje()).slice(0, 7)
const mesBr = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`
const dataBr = (iso: string) => iso.split('-').reverse().join('/')

const ORGANIZACAO_INSTALACAO = { ...ORGANIZACAO }

interface OrganizacaoMock extends Omit<Organizacao, 'temLogo' | 'fusoHorario' | 'padrao'> {
  logo: { conteudo: string; tipo: string } | null
}

interface ImportacaoMock extends Omit<Importacao, 'podeDesfazer'> {
  criados: number[]
}

function resumo(i: ImportacaoMock, podeDesfazer: boolean): Importacao {
  const { id, tipo, arquivo, usuario, registradaEm, linhasTotal, linhasImportadas, mesesFechados, situacao, desfeitaPor, desfeitaEm } = i
  return { id, tipo, arquivo, usuario, registradaEm, linhasTotal, linhasImportadas, mesesFechados: [...mesesFechados], situacao, podeDesfazer, desfeitaPor, desfeitaEm }
}

/** Valida CNPJ pelos dígitos verificadores (o mesmo de `shared.domain.Cnpj` do backend). */
function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const digito = (pesos: number[]) => {
    const resto = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0) % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13])
}

/** Leitura de CSV como o Excel salva (";" ou ",", aspas, BOM), com o número da linha da planilha. */
function lerCsv(texto: string, colunas: string[]): { numero: number; valores: Record<string, string> }[] {
  const conteudo = texto.replace(/^﻿/, '')
  const primeira = conteudo.split('\n')[0]
  const separador = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const registros: string[][] = []
  let atual: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i]
    if (aspas) {
      if (c === '"' && conteudo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === separador) {
      atual.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && conteudo[i + 1] === '\n') i++
      atual.push(campo)
      registros.push(atual)
      atual = []
      campo = ''
    } else campo += c
  }
  if (campo || atual.length > 0) {
    atual.push(campo)
    registros.push(atual)
  }
  const cabecalho = (registros[0] ?? []).map((n) => normalizarTexto(n).replace(/-/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
  const faltando = colunas.filter((c) => !cabecalho.includes(c))
  if (faltando.length > 0) throw validacao('arquivo', `Use o modelo: faltam as colunas ${faltando.join(', ')}.`)
  const linhas = registros
    .map((r, i) => ({ numero: i + 1, valores: Object.fromEntries(cabecalho.map((c, j) => [c, (r[j] ?? '').trim()])) }))
    .slice(1)
    .filter((l) => Object.values(l.valores).some((v) => v !== ''))
  if (linhas.length === 0) throw validacao('arquivo', 'O arquivo não tem linhas para importar.')
  return linhas
}

function data(valor: string): string | null {
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor.trim())
  const iso = br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : valor.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) || paraIsoData(d) !== iso ? null : iso
}

function mes(valor: string): string | null {
  const br = /^(\d{1,2})\/(\d{4})$/.exec(valor.trim())
  const iso = br ? `${br[2]}-${br[1].padStart(2, '0')}` : valor.trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(iso) ? iso : null
}

function valor(texto: string): number | null {
  let v = texto.replace('R$', '').replace(/\s/g, '')
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return null
  return Number(v)
}

function consentimento(texto: string): 'SIM' | 'NAO' | 'NAO_INFORMADO' | null {
  const t = normalizarTexto(texto)
  if (t === '') return 'NAO_INFORMADO'
  if (t === 'sim' || t === 's') return 'SIM'
  if (t === 'nao' || t === 'n') return 'NAO'
  return null
}

function decodificar(base64: string): string {
  const binario = atob(base64)
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

interface LinhaFinanceira {
  data: string
  contaId: number
  contaNome: string
  tipo: TipoCategoria
  categoria: string
  categoriaNome: string
  descricao: string
  valor: number
}

interface Analise {
  previa: PreviaImportacao
  financeiras: LinhaFinanceira[]
  doadores: { linha: number; doador: DoadorImportadoMock }[]
}

/** Espelho simulado do módulo Administração (US-ADMIN-001 a 005, 009, 012 e 021). */
class BancoAdministracao {
  private eventos: EventoAuditoria[] = []
  private modelosAtuais = new Map<TipoModelo, ModeloMensagem>()
  private organizacaoAtual: OrganizacaoMock | null = null
  private importacoesRegistradas: ImportacaoMock[] = []
  private proximoEvento = 1
  private proximaImportacao = 1

  constructor() {
    this.reiniciar()
  }

  reiniciar(): void {
    reiniciarValoresMensalidade()
    Object.assign(ORGANIZACAO, ORGANIZACAO_INSTALACAO)
    this.eventos = []
    this.organizacaoAtual = null
    this.importacoesRegistradas = []
    this.proximoEvento = 1
    this.proximaImportacao = 1
    this.modelosAtuais = new Map([
      ['AGRADECIMENTO', { tipo: 'AGRADECIMENTO', ...MODELO_AGRADECIMENTO_PADRAO, variaveis: VARIAVEIS.AGRADECIMENTO, atualizadoPor: null, atualizadoEm: null }],
      ['ANIVERSARIO', { tipo: 'ANIVERSARIO', ...MODELO_ANIVERSARIO_PADRAO, variaveis: VARIAVEIS.ANIVERSARIO, atualizadoPor: null, atualizadoEm: null }],
    ])
  }

  // US-ADMIN-009

  registrar(usuario: Usuario, perfil: Papel | null, acao: string, entidade: string, entidadeId: string | number, detalhes: Record<string, unknown> = {}): void {
    this.eventos.push({
      id: this.proximoEvento++,
      em: hoje().toISOString(),
      autorSubject: usuario.id,
      autorNome: usuario.nome,
      perfil,
      ip: '127.0.0.1',
      acao,
      entidade,
      entidadeId: String(entidadeId),
      detalhes,
    })
  }

  private registrarAlteracao(usuario: Usuario, perfil: Papel | null, acao: string, entidade: string, id: string | number, antes: unknown, depois: unknown, motivo?: string) {
    const detalhes: Record<string, unknown> = {}
    if (antes != null) detalhes.antes = antes
    if (depois != null) detalhes.depois = depois
    if (motivo) detalhes.motivo = motivo
    this.registrar(usuario, perfil, acao, entidade, id, detalhes)
  }

  /** O log próprio e o dos doadores simulados, do mais recente ao mais antigo; anonimizados sem valores. */
  private todos(): EventoAuditoria[] {
    const doadores: EventoAuditoria[] = bancoDoadores.auditoria.map((e, i) => ({
      id: -(i + 1),
      em: e.em,
      autorSubject: e.autor,
      autorNome: e.autor,
      perfil: null,
      ip: null,
      acao: e.acao,
      entidade: 'DOADOR',
      entidadeId: String(e.doadorId),
      detalhes: e.detalhes,
    }))
    const anonimizados = bancoDoadores.anonimizados(doadores.map((e) => Number(e.entidadeId)))
    return [...this.eventos, ...doadores]
      .map((e) => (e.entidade === 'DOADOR' && anonimizados.has(Number(e.entidadeId)) && e.acao !== 'DOADOR_ANONIMIZADO' ? { ...e, detalhes: {} } : e))
      .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
  }

  auditoria(f: FiltroAuditoria, pagina: number): PaginaAuditoria {
    if (f.de && f.ate && f.de > f.ate) throw validacao('de', 'A data inicial é posterior à final.')
    const usuario = normalizarTexto(f.usuario ?? '')
    const filtrados = this.todos().filter((e) => {
      const dia = paraIsoData(new Date(e.em))
      return (
        (!f.de || dia >= f.de) &&
        (!f.ate || dia <= f.ate) &&
        (!usuario || normalizarTexto(e.autorNome ?? '').includes(usuario) || e.autorSubject === f.usuario) &&
        (!f.acao || e.acao === f.acao) &&
        (!f.entidade || e.entidade === f.entidade) &&
        (!f.entidadeId || e.entidadeId === f.entidadeId.trim())
      )
    })
    const p = Math.max(pagina, 1)
    const itens = filtrados.slice((p - 1) * POR_PAGINA, p * POR_PAGINA)
    return { itens, pagina: p, temMais: filtrados.length > p * POR_PAGINA }
  }

  opcoes(): OpcoesAuditoria {
    const todos = this.todos()
    return {
      acoes: [...new Set(todos.map((e) => e.acao))].sort(),
      entidades: [...new Set(todos.map((e) => e.entidade))].sort(),
    }
  }

  historico(entidade: string, id: string): EventoAuditoria[] {
    return this.todos().filter((e) => e.entidade === entidade && e.entidadeId === id)
  }

  // US-ADMIN-021

  painel(): PainelAdministrador {
    const atual = mesAtual()
    const meses = [5, 4, 3, 2, 1, 0].map((i) => {
      const m = deslocarMes(atual, -i)
      const r = bancoFinanceiro.porCategoria(m)
      const soma = (lista: { valor: number }[]) => Math.round(lista.reduce((s, c) => s + c.valor, 0) * 100) / 100
      return { mes: m, receitas: soma(r.RECEITA), despesas: soma(r.DESPESA), vendas: soma(r.RECEITA.filter((c) => c.codigo === 'RECEITAS_VENDAS')) }
    })
    const [anterior, esteMes] = meses.slice(-2)
    return {
      mes: atual,
      doadoresAtivos: bancoDoadores.contarAtivos(),
      vendasNoMes: esteMes.vendas,
      vendasMesAnterior: anterior.vendas,
      resultadoNoMes: Math.round((esteMes.receitas - esteMes.despesas) * 100) / 100,
      resultadoMesAnterior: Math.round((anterior.receitas - anterior.despesas) * 100) / 100,
      receitasDespesas: meses,
      mensalidadeAgendada: this.mensalidade().agendada,
    }
  }

  // US-ADMIN-001

  usuarios(): ListaUsuarios {
    const pessoas = [
      ...USUARIOS_SIMULADOS,
      { id: 'u-voluntario', nome: 'Felipe Voluntário', papeis: ['vendedor'] as Papel[] },
    ]
    const usuarios: UsuarioIdentidade[] = pessoas.map((u, i) => {
      return {
        id: u.id,
        usuario: u.id.replace('u-', ''),
        nome: u.nome,
        email: `${u.id.replace('u-', '')}@cairbar.org`,
        papeis: u.papeis,
        habilitado: true,
        ultimoLogin: i < 3 ? new Date(hoje().getTime() - (i + 1) * 3_600_000).toISOString() : null,
        linkConsole: `https://keycloak.exemplo/admin/master/console/#/cecairbar/users/${u.id}/settings`,
      }
    })
    return { configurado: true, erro: null, usuarios: usuarios.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }
  }

  // US-ADMIN-002

  mensalidade(): SituacaoMensalidade {
    const atual = mesAtual()
    const ordenados = [...VALORES_MENSALIDADE].sort((a, b) => a.vigenteDe.localeCompare(b.vigenteDe))
    const vigente = ordenados.filter((v) => v.vigenteDe <= atual).pop() ?? ordenados[0]
    return {
      vigente: { ...vigente },
      agendada: ordenados.find((v) => v.vigenteDe > atual) ?? null,
      historico: ordenados.reverse().map((v) => ({ ...v })),
      mesAtual: atual,
    }
  }

  agendar(usuario: Usuario, perfil: Papel | null, dados: NovoValorMensalidade): SituacaoMensalidade {
    const s = this.mensalidade()
    if (s.agendada) throw regra('AGENDAMENTO_EXISTENTE', 'Já existe uma alteração agendada. Altere ou cancele a alteração agendada.')
    this.validarValor(dados, s)
    const novo: ValorMensalidadeMock = {
      id: Math.max(...VALORES_MENSALIDADE.map((v) => v.id)) + 1,
      valor: dados.valor,
      vigenteDe: dados.vigenteDe,
      motivo: compactar(dados.motivo),
      autor: { subject: usuario.id, nome: usuario.nome, em: hoje().toISOString() },
    }
    VALORES_MENSALIDADE.push(novo)
    this.registrarAlteracao(usuario, perfil, 'MENSALIDADE_AGENDADA', 'Mensalidade', novo.id, { valor: s.vigente.valor }, { valor: novo.valor, vigenteDe: novo.vigenteDe }, novo.motivo ?? undefined)
    return this.mensalidade()
  }

  alterarAgendamento(usuario: Usuario, perfil: Papel | null, dados: NovoValorMensalidade): SituacaoMensalidade {
    const s = this.mensalidade()
    const agendada = VALORES_MENSALIDADE.find((v) => v.id === s.agendada?.id)
    if (!agendada) throw regra('SEM_AGENDAMENTO', 'Não há alteração agendada: o mês dela já começou ou ela foi cancelada.')
    this.validarValor(dados, s)
    const antes = { valor: agendada.valor, vigenteDe: agendada.vigenteDe }
    Object.assign(agendada, {
      valor: dados.valor,
      vigenteDe: dados.vigenteDe,
      motivo: compactar(dados.motivo),
      autor: { subject: usuario.id, nome: usuario.nome, em: hoje().toISOString() },
    })
    this.registrarAlteracao(usuario, perfil, 'MENSALIDADE_AGENDAMENTO_ALTERADO', 'Mensalidade', agendada.id, antes, { valor: agendada.valor, vigenteDe: agendada.vigenteDe }, agendada.motivo ?? undefined)
    return this.mensalidade()
  }

  cancelarAgendamento(usuario: Usuario, perfil: Papel | null): SituacaoMensalidade {
    const agendada = this.mensalidade().agendada
    if (!agendada) throw regra('SEM_AGENDAMENTO', 'Não há alteração agendada: o mês dela já começou ou ela foi cancelada.')
    VALORES_MENSALIDADE.splice(VALORES_MENSALIDADE.findIndex((v) => v.id === agendada.id), 1)
    this.registrarAlteracao(usuario, perfil, 'MENSALIDADE_AGENDAMENTO_CANCELADO', 'Mensalidade', agendada.id, { valor: agendada.valor, vigenteDe: agendada.vigenteDe }, null)
    return this.mensalidade()
  }

  private validarValor(d: NovoValorMensalidade, s: SituacaoMensalidade): void {
    const erros = []
    if (!(d.valor > 0)) erros.push({ campo: 'valor', mensagem: 'Informe um valor maior que zero.' })
    else if (Math.round(d.valor * 100) === Math.round(s.vigente.valor * 100)) erros.push({ campo: 'valor', mensagem: 'O valor é igual ao vigente.' })
    if (!mes(d.vigenteDe ?? '') || d.vigenteDe <= s.mesAtual) {
      erros.push({ campo: 'vigenteDe', mensagem: 'O novo valor vale a partir do mês seguinte ou depois.' })
    }
    if (compactar(d.motivo).length < 5) erros.push({ campo: 'motivo', mensagem: 'Informe o motivo da alteração.' })
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
  }

  // US-ADMIN-003

  modelos(): ModeloMensagem[] {
    return (['AGRADECIMENTO', 'ANIVERSARIO'] as const).map((t) => ({ ...this.modelosAtuais.get(t)! }))
  }

  salvarModelo(usuario: Usuario, perfil: Papel | null, tipo: TipoModelo, textos: TextosModelo): ModeloMensagem {
    const atual = this.modelosAtuais.get(tipo)
    if (!atual) throw new ErroNegocio(404, 'MODELO_NAO_ENCONTRADO', 'Modelo não encontrado.')
    const erros = []
    for (const [campo, maximo] of [['whatsapp', 1000], ['emailAssunto', 200], ['emailCorpo', 4000]] as const) {
      const texto = textos[campo] ?? ''
      const desconhecidas = [...new Set([...texto.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).filter((v) => !VARIAVEIS[tipo].includes(v)))]
      if (!texto.trim()) erros.push({ campo, mensagem: 'Preencha o texto.' })
      else if (texto.length > maximo) erros.push({ campo, mensagem: `Use no máximo ${maximo} caracteres.` })
      else if (desconhecidas.length > 0) erros.push({ campo, mensagem: `Variável desconhecida: ${desconhecidas.map((v) => `{${v}}`).join(', ')}.` })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
    const novo: ModeloMensagem = {
      ...atual,
      whatsapp: textos.whatsapp.trim(),
      emailAssunto: textos.emailAssunto.trim(),
      emailCorpo: textos.emailCorpo.trim(),
      atualizadoPor: usuario.nome,
      atualizadoEm: hoje().toISOString(),
    }
    this.modelosAtuais.set(tipo, novo)
    const textosDe = (m: ModeloMensagem) => ({ whatsapp: m.whatsapp, emailAssunto: m.emailAssunto, emailCorpo: m.emailCorpo })
    this.registrarAlteracao(usuario, perfil, 'MODELO_MENSAGEM_ALTERADO', 'ModeloMensagem', tipo, textosDe(atual), textosDe(novo))
    return { ...novo }
  }

  // US-ADMIN-004

  planoDeContas(): CategoriaComSubcategorias[] {
    const emUso = bancoFinanceiro.categoriasEmUso()
    const paraPlano = (c: CategoriaPlanoMock): CategoriaPlano => ({
      codigo: c.codigo,
      nome: c.nome,
      tipo: c.tipo,
      categoriaPai: c.categoriaPai,
      sistema: c.sistema,
      ativa: c.ativa,
      emUso: emUso.has(c.codigo),
    })
    const porNome = (a: CategoriaPlanoMock, b: CategoriaPlanoMock) => a.nome.localeCompare(b.nome, 'pt-BR')
    return CATEGORIAS.filter((c) => !c.categoriaPai)
      .sort((a, b) => (a.tipo === b.tipo ? porNome(a, b) : a.tipo === 'RECEITA' ? -1 : 1))
      .map((c) => ({ categoria: paraPlano(c), subcategorias: CATEGORIAS.filter((s) => s.categoriaPai === c.codigo).sort(porNome).map(paraPlano) }))
  }

  criarCategoria(usuario: Usuario, perfil: Papel | null, dados: NovaCategoria): CategoriaPlano {
    const nome = compactar(dados.nome)
    const pai = dados.categoriaPai ? this.categoria(dados.categoriaPai) : null
    this.validarNome(nome, pai?.codigo ?? null, null)
    if (pai?.categoriaPai) throw validacao('categoriaPai', 'Subcategorias não têm outro nível.')
    if (pai && !pai.ativa) throw regra('CATEGORIA_INATIVA', `Reative a categoria ${pai.nome} antes.`)
    if (!pai && !dados.tipo) throw validacao('tipo', 'Escolha Receita ou Despesa.')
    const base = normalizarTexto(nome).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'CATEGORIA'
    let codigo = pai ? `${pai.codigo}.${base}` : base
    for (let i = 2; CATEGORIAS.some((c) => c.codigo === codigo); i++) codigo = `${pai ? `${pai.codigo}.` : ''}${base}_${i}`
    const nova: CategoriaPlanoMock = { codigo, nome, tipo: pai?.tipo ?? dados.tipo!, categoriaPai: pai?.codigo ?? null, ativa: true, sistema: false }
    CATEGORIAS.push(nova)
    this.registrarAlteracao(usuario, perfil, 'CATEGORIA_CRIADA', 'Categoria', codigo, null, { nome, tipo: nova.tipo })
    return { ...nova, emUso: false }
  }

  renomearCategoria(usuario: Usuario, perfil: Papel | null, codigo: string, nome: string): CategoriaPlano {
    const c = this.categoria(codigo)
    const limpo = compactar(nome)
    this.validarNome(limpo, c.categoriaPai, codigo)
    const antes = c.nome
    c.nome = limpo
    this.registrarAlteracao(usuario, perfil, 'CATEGORIA_RENOMEADA', 'Categoria', codigo, { nome: antes }, { nome: limpo })
    return { ...c, emUso: bancoFinanceiro.categoriasEmUso().has(codigo) }
  }

  inativarCategoria(usuario: Usuario, perfil: Papel | null, codigo: string): CategoriaPlano[] {
    const c = this.categoria(codigo)
    if (!c.ativa) throw regra('CATEGORIA_JA_INATIVA', `${c.nome} já está inativa.`)
    if (c.sistema) throw regra('CATEGORIA_SISTEMA', `${c.nome} é usada pelos lançamentos automáticos e não pode ser inativada.`)
    const subs = CATEGORIAS.filter((s) => s.categoriaPai === codigo && s.ativa)
    if (subs.some((s) => s.sistema)) {
      throw regra('CATEGORIA_SISTEMA', `${c.nome} tem subcategorias usadas pelos lançamentos automáticos e não pode ser inativada.`)
    }
    const inativadas = [c, ...subs]
    for (const x of inativadas) x.ativa = false
    this.registrarAlteracao(usuario, perfil, 'CATEGORIA_INATIVADA', 'Categoria', codigo, null, { inativadas: inativadas.map((x) => x.nome) })
    const emUso = bancoFinanceiro.categoriasEmUso()
    return inativadas.map((x) => ({ ...x, emUso: emUso.has(x.codigo) }))
  }

  reativarCategoria(usuario: Usuario, perfil: Papel | null, codigo: string): CategoriaPlano {
    const c = this.categoria(codigo)
    if (c.ativa) throw regra('CATEGORIA_JA_ATIVA', `${c.nome} já está ativa.`)
    const pai = c.categoriaPai ? this.categoria(c.categoriaPai) : null
    if (pai && !pai.ativa) throw regra('CATEGORIA_INATIVA', `Reative a categoria ${pai.nome} antes.`)
    c.ativa = true
    this.registrarAlteracao(usuario, perfil, 'CATEGORIA_REATIVADA', 'Categoria', codigo, null, { nome: c.nome })
    return { ...c, emUso: bancoFinanceiro.categoriasEmUso().has(codigo) }
  }

  excluirCategoria(usuario: Usuario, perfil: Papel | null, codigo: string): void {
    const c = this.categoria(codigo)
    if (c.sistema) throw regra('CATEGORIA_SISTEMA', `${c.nome} é usada pelos lançamentos automáticos e não pode ser excluída.`)
    if (CATEGORIAS.some((s) => s.categoriaPai === codigo)) {
      throw regra('CATEGORIA_COM_SUBCATEGORIAS', `Exclua ou mova as subcategorias de ${c.nome} antes.`)
    }
    if (bancoFinanceiro.categoriasEmUso().has(codigo)) throw regra('CATEGORIA_EM_USO', `${c.nome} já foi usada e só pode ser inativada.`)
    CATEGORIAS.splice(CATEGORIAS.indexOf(c), 1)
    this.registrarAlteracao(usuario, perfil, 'CATEGORIA_EXCLUIDA', 'Categoria', codigo, { nome: c.nome }, null)
  }

  private categoria(codigo: string): CategoriaPlanoMock {
    const c = CATEGORIAS.find((x) => x.codigo === codigo)
    if (!c) throw new ErroNegocio(404, 'CATEGORIA_NAO_ENCONTRADA', 'Categoria não encontrada.')
    return c
  }

  private validarNome(nome: string, pai: string | null, exceto: string | null): void {
    if (!nome) throw validacao('nome', 'Informe o nome.')
    if (nome.length > 100) throw validacao('nome', 'Use no máximo 100 caracteres.')
    const repetido = CATEGORIAS.some((c) => c.categoriaPai === pai && c.codigo !== exceto && normalizarTexto(c.nome) === normalizarTexto(nome))
    if (repetido) {
      throw validacao('nome', pai ? 'Já existe uma subcategoria com esse nome nesta categoria.' : 'Já existe uma categoria com esse nome.')
    }
  }

  // US-ADMIN-005

  organizacao(): Organizacao {
    const o = this.organizacaoAtual
    if (!o) {
      return {
        razaoSocial: ORGANIZACAO_INSTALACAO.nome,
        nomeExibicao: ORGANIZACAO_INSTALACAO.nome,
        cnpj: apenasDigitos(ORGANIZACAO_INSTALACAO.cnpj) || null,
        endereco: ORGANIZACAO_INSTALACAO.endereco || null,
        telefone: null,
        email: null,
        temLogo: false,
        rodapeRecibo: ORGANIZACAO_INSTALACAO.rodape || null,
        tipoChavePix: null,
        chavePix: null,
        cidadePix: null,
        fusoHorario: 'America/Sao_Paulo',
        padrao: true,
        atualizadoPor: null,
        atualizadoEm: null,
      }
    }
    const { logo, ...resto } = o
    return { ...resto, temLogo: !!logo, fusoHorario: 'America/Sao_Paulo', padrao: false }
  }

  salvarOrganizacao(usuario: Usuario, perfil: Papel | null, d: DadosOrganizacao): Organizacao {
    const erros = []
    const razao = compactar(d.razaoSocial)
    const nome = compactar(d.nomeExibicao)
    const cnpj = apenasDigitos(d.cnpj ?? '')
    const telefone = apenasDigitos(d.telefone ?? '')
    const email = compactar(d.email)
    if (!razao) erros.push({ campo: 'razaoSocial', mensagem: 'Informe a razão social.' })
    if (!nome) erros.push({ campo: 'nomeExibicao', mensagem: 'Informe o nome de exibição.' })
    if (cnpj && !cnpjValido(cnpj)) erros.push({ campo: 'cnpj', mensagem: 'CNPJ inválido.' })
    if (telefone && (telefone.length < 10 || telefone.length > 11)) erros.push({ campo: 'telefone', mensagem: 'Telefone inválido. Informe DDD e 10 ou 11 dígitos.' })
    if (email && !validarEmail(email)) erros.push({ campo: 'email', mensagem: 'E-mail inválido.' })
    if (d.logo && (!['image/png', 'image/jpeg'].includes(d.logo.tipo) || (d.logo.conteudo.length * 3) / 4 > 1024 * 1024)) {
      erros.push({ campo: 'logo', mensagem: 'Envie o logotipo em PNG ou JPG de até 1 MB.' })
    }
    if (d.tipoChavePix) {
      const erroChave = erroChavePix(d.tipoChavePix, d.chavePix ?? '')
      const erroCidade = erroCidadePix(d.cidadePix ?? '')
      if (erroChave) erros.push({ campo: 'chavePix', mensagem: erroChave })
      if (erroCidade) erros.push({ campo: 'cidadePix', mensagem: erroCidade })
    } else if (compactar(d.chavePix)) {
      erros.push({ campo: 'tipoChavePix', mensagem: 'Informe o tipo da chave PIX.' })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
    const antes = this.organizacao()
    const logo = d.removerLogo ? null : (d.logo ?? this.organizacaoAtual?.logo ?? null)
    this.organizacaoAtual = {
      razaoSocial: razao,
      nomeExibicao: nome,
      cnpj: cnpj || null,
      endereco: compactar(d.endereco) || null,
      telefone: telefone || null,
      email: email || null,
      logo,
      rodapeRecibo: compactar(d.rodapeRecibo) || null,
      tipoChavePix: d.tipoChavePix || null,
      chavePix: d.tipoChavePix ? normalizarChavePix(d.tipoChavePix, d.chavePix) : null,
      cidadePix: d.tipoChavePix ? compactar(d.cidadePix) : null,
      atualizadoPor: usuario.nome,
      atualizadoEm: hoje().toISOString(),
    }
    // Recibos, comprovantes e relatórios gerados daqui em diante usam os dados novos.
    Object.assign(ORGANIZACAO, {
      nome,
      cnpj: cnpj ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : '',
      endereco: this.organizacaoAtual.endereco ?? '',
      rodape: this.organizacaoAtual.rodapeRecibo ?? '',
    })
    const campos = (o: Organizacao) => ({ razaoSocial: o.razaoSocial, nomeExibicao: o.nomeExibicao, cnpj: o.cnpj, endereco: o.endereco, telefone: o.telefone, email: o.email, rodapeRecibo: o.rodapeRecibo, tipoChavePix: o.tipoChavePix, chavePix: o.chavePix, cidadePix: o.cidadePix })
    const depois: Record<string, unknown> = campos(this.organizacao())
    if (d.logo || d.removerLogo) depois.logo = d.removerLogo ? 'removido' : 'alterado'
    this.registrarAlteracao(usuario, perfil, 'ORGANIZACAO_ALTERADA', 'Organizacao', 1, campos(antes), depois)
    return this.organizacao()
  }

  logo(): { conteudo: Uint8Array; tipo: string } | null {
    const l = this.organizacaoAtual?.logo
    return l ? { conteudo: Uint8Array.from(atob(l.conteudo), (c) => c.charCodeAt(0)), tipo: l.tipo } : null
  }

  // US-ADMIN-012

  modeloImportacao(tipo: TipoImportacao): string {
    const conteudo =
      tipo === 'FINANCEIRO'
        ? 'Data;Conta;Tipo;Subcategoria;Descrição;Valor\r\n15/03/2026;Caixa Secretaria;Receita;Receitas de contribuições › Mensalidades;Mensalidades de março;1.250,00\r\n20/03/2026;Banco A;Despesa;Despesas operacionais › Energia elétrica;Conta de luz de março;312,45\r\n'
        : 'Nome;Telefone;E-mail;Data de nascimento;CPF;Consentimento WhatsApp;Consentimento e-mail;Competências pendentes\r\nMaria da Silva;(11) 98765-4321;maria@exemplo.com;12/10/1970;;Sim;Não;08/2026, 09/2026\r\n'
    return `﻿${conteudo}`
  }

  importacoes(): Importacao[] {
    return [...this.importacoesRegistradas].reverse().map((i) => resumo(i, i.situacao === 'CONCLUIDA' && this.intocada(i.id)))
  }

  previa(envio: EnvioImportacao): PreviaImportacao {
    return this.analisar(envio).previa
  }

  importar(usuario: Usuario, perfil: Papel | null, envio: EnvioImportacao, decisoes: Record<number, DecisaoDuplicata>): Importacao {
    const a = this.analisar(envio)
    if (a.previa.erros.length > 0) {
      throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', a.previa.erros.map((e) => ({ campo: `linha ${e.linha}${e.coluna ? ` · ${e.coluna}` : ''}`, mensagem: e.mensagem })))
    }
    const semDecisao = a.previa.duplicatas.map((d) => d.linha).filter((l) => decisoes[l] !== 'IMPORTAR' && decisoes[l] !== 'IGNORAR')
    if (semDecisao.length > 0) throw regra('DUPLICATAS_SEM_DECISAO', `Decida as possíveis duplicatas das linhas ${semDecisao.join(', ')}.`)
    const id = this.proximaImportacao++
    const criados: number[] = []
    if (envio.tipo === 'FINANCEIRO') {
      for (const l of a.financeiras) {
        criados.push(bancoFinanceiro.importar(l.data, id, l.descricao, l.contaId, l.categoria, l.tipo === 'RECEITA' ? l.valor : -l.valor, usuario))
      }
      bancoFechamento.fecharImportados(usuario, a.previa.mesesAFechar, id)
    } else {
      for (const l of a.doadores) {
        if (decisoes[l.linha] !== 'IGNORAR') criados.push(bancoDoadores.importar(l.doador, usuario.nome))
      }
    }
    const registro: ImportacaoMock = {
      id,
      tipo: envio.tipo,
      arquivo: envio.arquivo,
      usuario: usuario.nome,
      registradaEm: hoje().toISOString(),
      linhasTotal: a.previa.linhas,
      linhasImportadas: criados.length,
      mesesFechados: envio.tipo === 'FINANCEIRO' ? a.previa.mesesAFechar : [],
      situacao: 'CONCLUIDA',
      desfeitaPor: null,
      desfeitaEm: null,
      criados,
    }
    this.importacoesRegistradas.push(registro)
    this.registrar(usuario, perfil, 'IMPORTACAO_CONCLUIDA', 'Importacao', id, { tipo: envio.tipo, arquivo: envio.arquivo, linhas: registro.linhasTotal, importadas: criados.length })
    return resumo(registro, true)
  }

  desfazer(usuario: Usuario, perfil: Papel | null, id: number): Importacao {
    const i = this.importacoesRegistradas.find((x) => x.id === id)
    if (!i) throw new ErroNegocio(404, 'IMPORTACAO_NAO_ENCONTRADA', 'Importação não encontrada.')
    if (i.situacao === 'DESFEITA') throw regra('IMPORTACAO_DESFEITA', 'Esta importação já foi desfeita.')
    if (!this.intocada(id)) {
      throw regra(
        'IMPORTACAO_COM_MOVIMENTOS',
        i.tipo === 'FINANCEIRO'
          ? 'Algum lançamento importado já foi corrigido ou um mês fechado pela importação foi reaberto.'
          : 'Algum doador importado já recebeu contribuição, nota ou alteração.',
      )
    }
    if (i.tipo === 'FINANCEIRO') {
      bancoFinanceiro.desfazerImportacao(id)
      bancoFechamento.desfazerImportados(i.mesesFechados)
    } else {
      i.criados.forEach((d) => bancoDoadores.excluirImportado(d))
    }
    Object.assign(i, { situacao: 'DESFEITA', desfeitaPor: usuario.nome, desfeitaEm: hoje().toISOString() })
    this.registrar(usuario, perfil, 'IMPORTACAO_DESFEITA', 'Importacao', id, { removidos: i.criados.length })
    return resumo(i, false)
  }

  private intocada(id: number): boolean {
    const i = this.importacoesRegistradas.find((x) => x.id === id)
    if (!i) return false
    return i.tipo === 'FINANCEIRO'
      ? bancoFinanceiro.importacaoIntocada(id) && bancoFechamento.importadosIntocados(i.mesesFechados)
      : i.criados.every((d) => bancoDoadores.importadoIntocado(d))
  }

  private analisar(envio: EnvioImportacao): Analise {
    if (!envio.tipo) throw validacao('tipo', 'Escolha o tipo da planilha.')
    if (!/\.(csv|txt)$/i.test(envio.arquivo ?? '')) throw validacao('arquivo', 'Envie a planilha em CSV (no Excel: Arquivo › Salvar como › CSV).')
    if (!envio.conteudo) throw validacao('arquivo', 'Envie o arquivo.')
    const texto = decodificar(envio.conteudo)
    return envio.tipo === 'FINANCEIRO' ? this.analisarFinanceiro(envio.arquivo, texto) : this.analisarDoadores(envio.arquivo, texto)
  }

  private analisarFinanceiro(arquivo: string, texto: string): Analise {
    const linhas = lerCsv(texto, ['data', 'conta', 'tipo', 'subcategoria', 'descricao', 'valor'])
    const erros: ErroLinha[] = []
    const validas: LinhaFinanceira[] = []
    for (const { numero, valores: v } of linhas) {
      const antes = erros.length
      const dia = data(v.data)
      if (!dia) erros.push({ linha: numero, coluna: 'Data', mensagem: 'Informe a data como dd/mm/aaaa.' })
      const conta = CONTAS.find((c) => c.tipo !== 'CARTAO_A_RECEBER' && v.conta && (normalizarTexto(c.nome) === normalizarTexto(v.conta) || normalizarTexto(c.codigo) === normalizarTexto(v.conta)))
      if (!conta) {
        erros.push({ linha: numero, coluna: 'Conta', mensagem: v.conta ? `Conta "${v.conta}" não encontrada entre os caixas e contas bancárias.` : 'Informe a conta.' })
      } else if (dia && dia >= conta.dataCorte) {
        erros.push({ linha: numero, coluna: 'Data', mensagem: `O histórico de ${conta.nome} deve ser anterior à data de corte (${dataBr(conta.dataCorte)}).` })
      }
      const tipo = normalizarTexto(v.tipo) === 'receita' ? 'RECEITA' : normalizarTexto(v.tipo) === 'despesa' ? 'DESPESA' : null
      if (!tipo) erros.push({ linha: numero, coluna: 'Tipo', mensagem: 'Informe Receita ou Despesa.' })
      const partes = v.subcategoria.split(/\s*[›>/]\s*/)
      const candidatas = CATEGORIAS.filter((c) => {
        if (!c.categoriaPai || c.tipo !== tipo) return false
        if (partes.length === 2) {
          const mae = CATEGORIAS.find((m) => m.codigo === c.categoriaPai)
          return normalizarTexto(c.nome) === normalizarTexto(partes[1]) && normalizarTexto(mae?.nome ?? '') === normalizarTexto(partes[0])
        }
        return normalizarTexto(c.nome) === normalizarTexto(v.subcategoria) || c.codigo === v.subcategoria
      })
      const sub = candidatas.length === 1 ? candidatas[0] : null
      if (tipo && !sub) {
        erros.push({
          linha: numero,
          coluna: 'Subcategoria',
          mensagem: v.subcategoria
            ? `Subcategoria de ${tipo === 'RECEITA' ? 'receita' : 'despesa'} "${v.subcategoria}" não encontrada. Use "Categoria › Subcategoria" do plano de contas.`
            : 'Informe a subcategoria.',
        })
      }
      const descricao = compactar(v.descricao)
      if (!descricao) erros.push({ linha: numero, coluna: 'Descrição', mensagem: 'Informe a descrição.' })
      else if (descricao.length > 200) erros.push({ linha: numero, coluna: 'Descrição', mensagem: 'Use no máximo 200 caracteres.' })
      const quantia = valor(v.valor)
      if (quantia === null || quantia <= 0) erros.push({ linha: numero, coluna: 'Valor', mensagem: 'Informe um valor maior que zero, como 1.234,56.' })
      if (dia && travaPeriodo.estaFechado(dia.slice(0, 7))) {
        erros.push({ linha: numero, coluna: 'Data', mensagem: `O mês ${mesBr(dia.slice(0, 7))} já está fechado.` })
      }
      if (erros.length === antes && dia && conta && tipo && sub && quantia) {
        const mae = CATEGORIAS.find((m) => m.codigo === sub.categoriaPai)
        validas.push({ data: dia, contaId: conta.id, contaNome: conta.nome, tipo, categoria: sub.codigo, categoriaNome: `${mae?.nome} › ${sub.nome}`, descricao, valor: quantia })
      }
    }
    const totais = (chave: (l: LinhaFinanceira) => string): TotalImportacao[] => {
      const mapa = new Map<string, TotalImportacao>()
      for (const l of validas) {
        const t = mapa.get(chave(l)) ?? { nome: chave(l), receitas: 0, despesas: 0, linhas: 0 }
        if (l.tipo === 'RECEITA') t.receitas = Math.round((t.receitas + l.valor) * 100) / 100
        else t.despesas = Math.round((t.despesas + l.valor) * 100) / 100
        t.linhas++
        mapa.set(t.nome, t)
      }
      return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    }
    return {
      previa: {
        tipo: 'FINANCEIRO',
        arquivo,
        linhas: linhas.length,
        erros,
        totaisPorConta: totais((l) => l.contaNome),
        totaisPorCategoria: totais((l) => l.categoriaNome),
        mesesAFechar: [...new Set(validas.map((l) => l.data.slice(0, 7)))].sort(),
        duplicatas: [],
        doadores: 0,
        competencias: 0,
      },
      financeiras: validas,
      doadores: [],
    }
  }

  private analisarDoadores(arquivo: string, texto: string): Analise {
    const linhas = lerCsv(texto, ['nome', 'telefone', 'email', 'data_de_nascimento', 'cpf', 'consentimento_whatsapp', 'consentimento_email', 'competencias_pendentes'])
    const atual = mesAtual()
    const erros: ErroLinha[] = []
    const validas: Analise['doadores'] = []
    const duplicatas: DuplicataLinha[] = []
    const vistos = { telefone: new Map<string, number>(), email: new Map<string, number>(), cpf: new Map<string, number>() }
    const rotulo: Record<string, string> = { nome: 'Nome', telefone: 'Telefone', email: 'E-mail', cpf: 'CPF' }
    for (const { numero, valores: v } of linhas) {
      const antes = erros.length
      const nascimento = v.data_de_nascimento ? data(v.data_de_nascimento) : null
      if (v.data_de_nascimento && !nascimento) erros.push({ linha: numero, coluna: 'Data de nascimento', mensagem: 'Informe a data como dd/mm/aaaa.' })
      else if (nascimento && nascimento > paraIsoData(hoje())) erros.push({ linha: numero, coluna: 'Data de nascimento', mensagem: 'A data de nascimento não pode ser futura.' })
      const whatsapp = consentimento(v.consentimento_whatsapp)
      if (!whatsapp) erros.push({ linha: numero, coluna: 'Consentimento WhatsApp', mensagem: 'Use Sim, Não ou deixe em branco.' })
      const email = consentimento(v.consentimento_email)
      if (!email) erros.push({ linha: numero, coluna: 'Consentimento e-mail', mensagem: 'Use Sim, Não ou deixe em branco.' })
      const meses = v.competencias_pendentes.split(/[,;\s]+/).filter(Boolean).map(mes)
      if (meses.some((m) => m === null)) {
        erros.push({ linha: numero, coluna: 'Competências pendentes', mensagem: 'Informe os meses como mm/aaaa separados por vírgula.' })
      } else if (meses.some((m) => m! > atual)) {
        erros.push({ linha: numero, coluna: 'Competências pendentes', mensagem: 'Competências futuras não são importadas; elas são geradas mês a mês.' })
      }
      const doador: DoadorImportadoMock = {
        nome: compactar(v.nome),
        telefone: v.telefone,
        email: v.email,
        dataNascimento: nascimento,
        cpf: apenasDigitos(v.cpf) || null,
        consentimentoWhatsapp: whatsapp ?? 'NAO_INFORMADO',
        consentimentoEmail: email ?? 'NAO_INFORMADO',
        competenciasPendentes: [...new Set(meses.filter((m): m is string => m !== null))],
      }
      for (const e of bancoDoadores.validarImportado(doador)) erros.push({ linha: numero, coluna: rotulo[e.campo] ?? e.campo, mensagem: e.mensagem })
      for (const [campo, chave, coluna] of [
        ['telefone', apenasDigitos(v.telefone), 'Telefone'],
        ['email', normalizarTexto(v.email), 'E-mail'],
        ['cpf', doador.cpf ?? '', 'CPF'],
      ] as const) {
        if (!chave) continue
        const anterior = vistos[campo].get(chave)
        if (anterior) erros.push({ linha: numero, coluna, mensagem: `Repetido na linha ${anterior} do arquivo.` })
        else vistos[campo].set(chave, numero)
      }
      if (erros.length === antes && doador.cpf && validarCpf(doador.cpf) && bancoDoadores.cpfEmUso(doador.cpf)) {
        erros.push({ linha: numero, coluna: 'CPF', mensagem: 'CPF já cadastrado em outro doador.' })
      }
      if (erros.length === antes) {
        validas.push({ linha: numero, doador })
        const possiveis = bancoDoadores.verificarDuplicatas({ nome: doador.nome, telefone: validarTelefone(doador.telefone) ? doador.telefone : '', email: doador.email })
        if (possiveis.length > 0) {
          duplicatas.push({ linha: numero, nome: doador.nome, possiveis: possiveis.map((p) => ({ id: p.doador.id, nome: p.doador.nome, motivos: p.motivos })) })
        }
      }
    }
    return {
      previa: {
        tipo: 'DOADORES',
        arquivo,
        linhas: linhas.length,
        erros,
        totaisPorConta: [],
        totaisPorCategoria: [],
        mesesAFechar: [],
        duplicatas,
        doadores: validas.length,
        competencias: validas.reduce((s, d) => s + d.doador.competenciasPendentes.length, 0),
      },
      financeiras: [],
      doadores: validas,
    }
  }
}

export { valorMensalidade }
export const bancoAdministracao = new BancoAdministracao()
