import type { Competencia } from '../features/contribuicoes/types'
import type {
  AnonimizacaoDoador,
  AtualizacaoDoador,
  Aniversariante,
  CadastroRapido,
  Consentimento,
  DadosDuplicidade,
  Doador,
  Endereco,
  InativacaoDoador,
  MotivoDuplicidade,
  NotaDoador,
  PossivelDuplicata,
  ReativacaoDoador,
  ResultadoAniversariantes,
  ResumoDoador,
  Telefone,
  ValorConsentimento,
} from '../features/doadores/types'
import { LIMITE_NOTA, MINIMO_BUSCA } from '../features/doadores/types'
import { apenasDigitos } from '../shared/formatters/formatadores'
import { dePartesIso, hoje, paraIsoData } from '../shared/formatters/datas'
import { normalizarTexto, similaridade } from '../shared/text/texto'
import { validarCep, validarCpf, validarEmail, validarTelefone } from '../shared/validators/validadores'
import { ErroNegocio } from './erroNegocio'
import { SEMENTES_DOADORES } from './fixtures/doadores'
import { valorMensalidade } from './tabelaMensalidade'

const LIMITE_SIMILARIDADE_NOME = 0.6

/** Linha válida da planilha de doadores (US-ADMIN-012). */
export interface DoadorImportadoMock {
  nome: string
  telefone: string
  email: string
  dataNascimento: string | null
  cpf: string | null
  consentimentoWhatsapp: 'SIM' | 'NAO' | 'NAO_INFORMADO'
  consentimentoEmail: 'SIM' | 'NAO' | 'NAO_INFORMADO'
  competenciasPendentes: string[]
}

export interface EventoAuditoria {
  em: string
  autor: string
  acao: string
  doadorId: number
  detalhes: Record<string, unknown>
}

/** Competência guardada no mock, com o vínculo à contribuição que a pagou. */
export interface CompetenciaMock extends Competencia {
  contribuicaoId?: number | null
  /** Antecipada: removida se a contribuição for cancelada antes do mês chegar. */
  criadaNoPagamento?: boolean
}

interface RegistroDoador {
  doador: Doador
  competencias: CompetenciaMock[]
  notas: NotaDoador[]
}

const CONSENTIMENTO_VAZIO: Consentimento = {
  valor: 'NAO_INFORMADO',
  registradoEm: null,
  registradoPor: null,
}

function competenciaDe(data: Date, mesesAtras: number): string {
  const d = new Date(data.getFullYear(), data.getMonth() - mesesAtras, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function competenciaAtual(): string {
  return competenciaDe(hoje(), 0)
}

function consentimento(valor: ValorConsentimento, autor: string): Consentimento {
  if (valor === 'NAO_INFORMADO') return { ...CONSENTIMENTO_VAZIO }
  return { valor, registradoEm: hoje().toISOString(), registradoPor: autor }
}

class BancoDoadores {
  private registros = new Map<number, RegistroDoador>()
  private proximoId = 1
  private proximaNota = 1
  readonly auditoria: EventoAuditoria[] = []

  constructor() {
    this.semear()
  }

  reiniciar(): void {
    this.registros.clear()
    this.auditoria.length = 0
    this.proximoId = 1
    this.proximaNota = 1
    this.semear()
  }

  private semear(): void {
    const agora = hoje()
    for (const s of SEMENTES_DOADORES) {
      const id = this.proximoId++
      let dataNascimento: string | null = null
      if (s.aniversarioEmDias !== null) {
        const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + s.aniversarioEmDias)
        dataNascimento = paraIsoData(new Date(alvo.getFullYear() - s.idade, alvo.getMonth(), alvo.getDate()))
      }
      this.registros.set(id, {
        doador: {
          id,
          nome: s.nome,
          cpf: s.cpf,
          dataNascimento,
          status: s.status,
          telefones: s.telefones,
          emails: s.emails,
          endereco: s.endereco,
          consentimentoWhatsapp: consentimento(s.whatsapp, 'seed'),
          consentimentoEmail: consentimento(s.email, 'seed'),
          criadoEm: agora.toISOString(),
          inativadoEm: s.status === 'INATIVO' ? agora.toISOString() : null,
          motivoInativacao: s.motivoInativacao ?? null,
        },
        competencias: s.competencias.map((c) => ({
          competencia: competenciaDe(agora, c.mesesAtras),
          valor: valorMensalidade(competenciaDe(agora, c.mesesAtras)),
          status: c.status,
          dataPagamento: c.status === 'PAGA' ? paraIsoData(agora) : null,
          numeroRecibo: c.status === 'PAGA' ? `R-${String(id).padStart(4, '0')}` : null,
        })),
        notas: [],
      })
    }
  }

  private registrar(autor: string, acao: string, doadorId: number, detalhes: Record<string, unknown>): void {
    this.auditoria.push({ em: hoje().toISOString(), autor, acao, doadorId, detalhes })
  }

  private obterRegistro(id: number): RegistroDoador {
    const registro = this.registros.get(id)
    if (!registro) throw new ErroNegocio(404, 'DOADOR_NAO_ENCONTRADO', 'Doador não encontrado.')
    return registro
  }

  private resumir(registro: RegistroDoador): ResumoDoador {
    const { doador } = registro
    return {
      id: doador.id,
      nome: doador.nome,
      telefonePrincipal: doador.telefones.find((t) => t.principal)?.numero ?? null,
      emailPrincipal: doador.emails.find((e) => e.principal)?.endereco ?? null,
      status: doador.status,
      competenciasPendentes: registro.competencias.filter((c) => c.status === 'PENDENTE').length,
    }
  }

  // US-DONOR-001
  buscar(termo: string): ResumoDoador[] {
    const bruto = termo.trim()
    if (bruto.length < MINIMO_BUSCA) return []
    const texto = normalizarTexto(bruto)
    const digitos = apenasDigitos(bruto)
    const buscaTelefone = /^[\d\s()+-]+$/.test(bruto) && digitos.length >= MINIMO_BUSCA
    const partes = texto.split(' ')

    const resultados = [...this.registros.values()].filter(({ doador }) => {
      if (doador.status === 'ANONIMIZADO') return false
      if (buscaTelefone) return doador.telefones.some((t) => t.numero.endsWith(digitos))
      if (bruto.includes('@')) return doador.emails.some((e) => normalizarTexto(e.endereco).includes(texto))
      const nome = normalizarTexto(doador.nome)
      return partes.every((p) => nome.includes(p))
    })

    const ordem = (r: RegistroDoador) => (r.doador.status === 'ATIVO' ? 0 : 1)
    return resultados
      .sort((a, b) => ordem(a) - ordem(b) || a.doador.nome.localeCompare(b.doador.nome, 'pt-BR'))
      .map((r) => this.resumir(r))
  }

  obter(id: number): Doador {
    return structuredClone(this.obterRegistro(id).doador)
  }

  // US-DONOR-002
  verificarDuplicatas({ nome, telefone, email }: DadosDuplicidade): PossivelDuplicata[] {
    const digitos = apenasDigitos(telefone)
    const emailNormalizado = email.trim().toLowerCase()
    const encontrados: PossivelDuplicata[] = []
    for (const registro of this.registros.values()) {
      const { doador } = registro
      if (doador.status === 'ANONIMIZADO') continue
      const motivos: MotivoDuplicidade[] = []
      if (digitos.length >= 10 && doador.telefones.some((t) => t.numero === digitos)) motivos.push('TELEFONE')
      if (emailNormalizado && doador.emails.some((e) => e.endereco.toLowerCase() === emailNormalizado)) {
        motivos.push('EMAIL')
      }
      if (nome.trim().length >= 3 && similaridade(nome, doador.nome) >= LIMITE_SIMILARIDADE_NOME) {
        motivos.push('NOME_SIMILAR')
      }
      if (motivos.length > 0) encontrados.push({ doador: this.resumir(registro), motivos })
    }
    return encontrados
  }

  private validarContatos(telefone: string, email: string): void {
    const erros = []
    if (!telefone.trim() && !email.trim()) {
      erros.push({ campo: 'telefone', mensagem: 'Informe ao menos um contato: celular ou e-mail.' })
    }
    if (telefone.trim() && !validarTelefone(telefone)) {
      erros.push({ campo: 'telefone', mensagem: 'Telefone inválido. Informe DDD e 10 ou 11 dígitos.' })
    }
    if (email.trim() && !validarEmail(email)) {
      erros.push({ campo: 'email', mensagem: 'E-mail inválido.' })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
  }

  cadastrarRapido(dados: CadastroRapido, autor: string): Doador {
    const erros = []
    if (dados.nome.trim().split(/\s+/).length < 2) {
      erros.push({ campo: 'nome', mensagem: 'Informe o nome completo.' })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)
    this.validarContatos(dados.telefone, dados.email)

    const id = this.proximoId++
    const telefones: Telefone[] = dados.telefone.trim()
      ? [{ tipo: 'CELULAR', numero: apenasDigitos(dados.telefone), principal: true }]
      : []
    const emails = dados.email.trim() ? [{ endereco: dados.email.trim(), principal: true }] : []
    const agora = hoje()
    const registro: RegistroDoador = {
      doador: {
        id,
        nome: dados.nome.trim().replace(/\s+/g, ' '),
        cpf: null,
        dataNascimento: null,
        status: 'ATIVO',
        telefones,
        emails,
        endereco: null,
        consentimentoWhatsapp: consentimento(dados.consentimentoWhatsapp, autor),
        consentimentoEmail: consentimento(dados.consentimentoEmail, autor),
        criadoEm: agora.toISOString(),
        inativadoEm: null,
        motivoInativacao: null,
      },
      // US-CONTRIB-001: competência do mês corrente gerada no cadastro.
      competencias: [
        { competencia: competenciaAtual(), valor: valorMensalidade(competenciaAtual()), status: 'PENDENTE', dataPagamento: null, numeroRecibo: null },
      ],
      notas: [],
    }
    this.registros.set(id, registro)
    this.registrar(autor, 'DOADOR_CADASTRADO', id, {})
    for (const descartado of dados.duplicatasDescartadas) {
      this.registrar(autor, 'DUPLICATA_DESCARTADA', id, { doadorSimilarId: descartado })
    }
    return structuredClone(registro.doador)
  }

  // US-DONOR-003
  atualizar(id: number, dados: AtualizacaoDoador, autor: string): Doador {
    const registro = this.obterRegistro(id)
    const { doador } = registro
    if (doador.status === 'ANONIMIZADO') {
      throw new ErroNegocio(409, 'DOADOR_ANONIMIZADO', 'Doador anonimizado não pode ser alterado.')
    }
    const erros = []
    if (dados.nome.trim().split(/\s+/).length < 2) {
      erros.push({ campo: 'nome', mensagem: 'Informe o nome completo.' })
    }
    const cpf = apenasDigitos(dados.cpf)
    if (cpf) {
      if (!validarCpf(cpf)) erros.push({ campo: 'cpf', mensagem: 'CPF inválido.' })
      else if ([...this.registros.values()].some((r) => r.doador.id !== id && r.doador.cpf === cpf)) {
        erros.push({ campo: 'cpf', mensagem: 'Já existe um doador com este CPF.' })
      }
    }
    for (const t of dados.telefones) {
      if (!validarTelefone(t.numero)) erros.push({ campo: 'telefones', mensagem: 'Telefone inválido.' })
    }
    for (const e of dados.emails) {
      if (!validarEmail(e.endereco)) erros.push({ campo: 'emails', mensagem: 'E-mail inválido.' })
    }
    if (dados.endereco?.cep && !validarCep(dados.endereco.cep)) {
      erros.push({ campo: 'cep', mensagem: 'CEP inválido.' })
    }
    if (dados.dataNascimento && dePartesIso(dados.dataNascimento) > hoje()) {
      erros.push({ campo: 'dataNascimento', mensagem: 'A data de nascimento não pode ser futura.' })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)

    const anterior = structuredClone(doador)
    doador.nome = dados.nome.trim().replace(/\s+/g, ' ')
    doador.cpf = cpf || null
    doador.dataNascimento = dados.dataNascimento || null
    doador.telefones = dados.telefones.map((t, i) => ({ ...t, numero: apenasDigitos(t.numero), principal: i === 0 || t.principal }))
    doador.emails = dados.emails.map((e, i) => ({ ...e, endereco: e.endereco.trim(), principal: i === 0 || e.principal }))
    doador.endereco = dados.endereco
    if (dados.consentimentoWhatsapp !== doador.consentimentoWhatsapp.valor) {
      doador.consentimentoWhatsapp = consentimento(dados.consentimentoWhatsapp, autor)
    }
    if (dados.consentimentoEmail !== doador.consentimentoEmail.valor) {
      doador.consentimentoEmail = consentimento(dados.consentimentoEmail, autor)
    }
    this.registrar(autor, 'DOADOR_ATUALIZADO', id, { anterior, novo: structuredClone(doador) })
    return structuredClone(doador)
  }

  // US-DONOR-004
  inativar(id: number, dados: InativacaoDoador, autor: string): Doador {
    const registro = this.obterRegistro(id)
    const { doador } = registro
    if (doador.status !== 'ATIVO') {
      throw new ErroNegocio(409, 'STATUS_INVALIDO', 'Somente doadores ativos podem ser inativados.')
    }
    if (!dados.motivo.trim()) {
      throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo: 'motivo', mensagem: 'Informe o motivo.' }])
    }
    let canceladas = 0
    if (dados.pendencias === 'CANCELAR') {
      for (const c of registro.competencias) {
        if (c.status === 'PENDENTE') {
          c.status = 'CANCELADA'
          canceladas++
        }
      }
    }
    doador.status = 'INATIVO'
    doador.inativadoEm = hoje().toISOString()
    doador.motivoInativacao = dados.motivo.trim()
    this.registrar(autor, 'DOADOR_INATIVADO', id, {
      motivo: dados.motivo.trim(),
      pendencias: dados.pendencias,
      competenciasAfetadas: canceladas,
    })
    return structuredClone(doador)
  }

  // US-DONOR-005
  reativar(id: number, dados: ReativacaoDoador, autor: string): Doador {
    const registro = this.obterRegistro(id)
    const { doador } = registro
    if (doador.status !== 'INATIVO') {
      throw new ErroNegocio(409, 'STATUS_INVALIDO', 'Somente doadores inativos podem ser reativados.')
    }
    if (!dados.motivo.trim()) {
      throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [{ campo: 'motivo', mensagem: 'Informe o motivo.' }])
    }
    doador.status = 'ATIVO'
    doador.inativadoEm = null
    doador.motivoInativacao = null
    const atual = competenciaAtual()
    if (!registro.competencias.some((c) => c.competencia === atual)) {
      registro.competencias.push({ competencia: atual, valor: valorMensalidade(atual), status: 'PENDENTE', dataPagamento: null, numeroRecibo: null })
    }
    this.registrar(autor, 'DOADOR_REATIVADO', id, { motivo: dados.motivo.trim() })
    return structuredClone(doador)
  }

  // US-DONOR-008
  anonimizar(id: number, dados: AnonimizacaoDoador, autor: string): Doador {
    const registro = this.obterRegistro(id)
    const { doador } = registro
    if (doador.status === 'ANONIMIZADO') {
      throw new ErroNegocio(409, 'STATUS_INVALIDO', 'O doador já está anonimizado.')
    }
    const erros = []
    if (!dados.motivo.trim()) erros.push({ campo: 'motivo', mensagem: 'Informe o motivo da solicitação.' })
    if (normalizarTexto(dados.nomeConfirmacao) !== normalizarTexto(doador.nome)) {
      erros.push({ campo: 'nomeConfirmacao', mensagem: 'O nome digitado não confere com o do doador.' })
    }
    if (doador.status === 'ATIVO' && !dados.pendencias) {
      erros.push({ campo: 'pendencias', mensagem: 'Decida o que fazer com as competências pendentes.' })
    }
    if (erros.length > 0) throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', erros)

    let canceladas = 0
    if (doador.status === 'ATIVO' && dados.pendencias === 'CANCELAR') {
      for (const c of registro.competencias) {
        if (c.status === 'PENDENTE') {
          c.status = 'CANCELADA'
          canceladas++
        }
      }
    }
    // Sobrescrita no lugar: nenhum valor apagado vai para a auditoria.
    doador.nome = `Doador anonimizado #${doador.id}`
    doador.cpf = null
    doador.dataNascimento = null
    doador.telefones = []
    doador.emails = []
    doador.endereco = null
    doador.consentimentoWhatsapp = { ...CONSENTIMENTO_VAZIO }
    doador.consentimentoEmail = { ...CONSENTIMENTO_VAZIO }
    doador.motivoInativacao = null
    doador.status = 'ANONIMIZADO'
    doador.inativadoEm ??= hoje().toISOString()
    registro.notas = []
    this.registrar(autor, 'DOADOR_ANONIMIZADO', id, {
      motivo: dados.motivo.trim(),
      pendencias: dados.pendencias ?? null,
      competenciasAfetadas: canceladas,
    })
    return structuredClone(doador)
  }

  // US-DONOR-012
  listarNotas(id: number): NotaDoador[] {
    return [...this.obterRegistro(id).notas].sort((a, b) => b.id - a.id)
  }

  adicionarNota(id: number, texto: string, autor: string): NotaDoador {
    const registro = this.obterRegistro(id)
    if (registro.doador.status === 'ANONIMIZADO') {
      throw new ErroNegocio(409, 'DOADOR_ANONIMIZADO', 'Doador anonimizado não aceita notas.')
    }
    const limpo = texto.trim()
    if (!limpo || limpo.length > LIMITE_NOTA) {
      throw new ErroNegocio(422, 'VALIDACAO', 'Dados inválidos.', [
        { campo: 'texto', mensagem: `A nota deve ter de 1 a ${LIMITE_NOTA} caracteres.` },
      ])
    }
    const nota: NotaDoador = { id: this.proximaNota++, texto: limpo, autor, criadaEm: hoje().toISOString() }
    registro.notas.push(nota)
    return nota
  }

  listarCompetencias(id: number): Competencia[] {
    return structuredClone(this.obterRegistro(id).competencias)
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
      .map(({ competencia, valor, status, dataPagamento, numeroRecibo }) => ({
        competencia,
        valor,
        status,
        dataPagamento,
        numeroRecibo,
      }))
  }

  // US-ADMIN-012 e 021 (porta do Doador para a Administração)

  contarAtivos(): number {
    return this.idsAtivos().length
  }

  anonimizados(ids: number[]): Set<number> {
    return new Set(ids.filter((id) => this.registros.get(id)?.doador.status === 'ANONIMIZADO'))
  }

  /** Erros do doador como ele seria cadastrado: nome completo, ao menos um contato e CPF válido. */
  validarImportado(d: DoadorImportadoMock): { campo: string; mensagem: string }[] {
    const erros: { campo: string; mensagem: string }[] = []
    if (d.nome.trim().split(/\s+/).length < 2) erros.push({ campo: 'nome', mensagem: 'Informe o nome completo.' })
    try {
      this.validarContatos(d.telefone, d.email)
    } catch (e) {
      if (e instanceof ErroNegocio) erros.push(...e.erros)
    }
    if (d.cpf && !validarCpf(d.cpf)) erros.push({ campo: 'cpf', mensagem: 'CPF inválido.' })
    return erros
  }

  cpfEmUso(cpf: string): boolean {
    return [...this.registros.values()].some((r) => r.doador.cpf === apenasDigitos(cpf))
  }

  /** Cadastra Ativo com as competências pendentes informadas e a do mês atual. */
  importar(d: DoadorImportadoMock, autor: string): number {
    const id = this.proximoId++
    const digitos = apenasDigitos(d.telefone)
    const agora = hoje()
    const meses = [...new Set([...d.competenciasPendentes, competenciaAtual()])].sort()
    this.registros.set(id, {
      doador: {
        id,
        nome: d.nome.trim().replace(/\s+/g, ' '),
        cpf: d.cpf ? apenasDigitos(d.cpf) : null,
        dataNascimento: d.dataNascimento,
        status: 'ATIVO',
        telefones: digitos ? [{ tipo: digitos.length === 10 ? 'FIXO' : 'CELULAR', numero: digitos, principal: true }] : [],
        emails: d.email.trim() ? [{ endereco: d.email.trim(), principal: true }] : [],
        endereco: null,
        consentimentoWhatsapp: consentimento(d.consentimentoWhatsapp, autor),
        consentimentoEmail: consentimento(d.consentimentoEmail, autor),
        criadoEm: agora.toISOString(),
        inativadoEm: null,
        motivoInativacao: null,
      },
      competencias: meses.map((m) => ({ competencia: m, valor: valorMensalidade(m), status: 'PENDENTE', dataPagamento: null, numeroRecibo: null })),
      notas: [],
    })
    this.registrar(autor, 'DOADOR_IMPORTADO', id, { competenciasPendentes: d.competenciasPendentes.length })
    return id
  }

  /** Sem notas, competência paga ou cancelada, nem outra ação depois da importação. */
  importadoIntocado(id: number): boolean {
    const r = this.registros.get(id)
    if (!r) return false
    return (
      r.notas.length === 0 &&
      r.competencias.every((c) => c.status === 'PENDENTE') &&
      this.auditoria.filter((e) => e.doadorId === id).every((e) => e.acao === 'DOADOR_IMPORTADO')
    )
  }

  excluirImportado(id: number): void {
    this.registros.delete(id)
  }

  /** Acesso direto do banco de contribuições simulado (no backend, módulos distintos). */
  competenciasDe(id: number): CompetenciaMock[] {
    return this.obterRegistro(id).competencias
  }

  /** Competências de todos os doadores (painel do Tesoureiro). */
  todasAsCompetencias(): CompetenciaMock[] {
    return [...this.registros.values()].flatMap((r) => r.competencias)
  }

  /** Doadores e competências, para o relatório de mensalidades (US-REPORT-004). */
  todosOsRegistros(): readonly { doador: Doador; competencias: CompetenciaMock[] }[] {
    return [...this.registros.values()]
  }

  doadorDe(id: number): Doador {
    return this.obterRegistro(id).doador
  }

  idsAtivos(): number[] {
    return [...this.registros.values()].filter((r) => r.doador.status === 'ATIVO').map((r) => r.doador.id)
  }

  // US-DONOR-007
  listarAniversariantes(de: string, ate: string): ResultadoAniversariantes {
    const inicio = dePartesIso(de)
    const fim = dePartesIso(ate)
    const itens: Aniversariante[] = []
    let semData = 0
    for (const { doador } of this.registros.values()) {
      if (doador.status !== 'ATIVO') continue
      if (!doador.dataNascimento) {
        semData++
        continue
      }
      const nasc = dePartesIso(doador.dataNascimento)
      for (let ano = inicio.getFullYear(); ano <= fim.getFullYear(); ano++) {
        // 29/02 em ano não bissexto é comemorado em 28/02.
        let aniversario = new Date(ano, nasc.getMonth(), nasc.getDate())
        if (aniversario.getMonth() !== nasc.getMonth()) aniversario = new Date(ano, nasc.getMonth(), 28)
        if (aniversario >= inicio && aniversario <= fim) {
          itens.push({
            doadorId: doador.id,
            nome: doador.nome,
            dataAniversario: paraIsoData(aniversario),
            idadeACompletar: ano - nasc.getFullYear(),
            consentimentoWhatsapp: doador.consentimentoWhatsapp.valor,
            consentimentoEmail: doador.consentimentoEmail.valor,
            telefonePrincipal: doador.telefones.find((t) => t.principal)?.numero ?? null,
            emailPrincipal: doador.emails.find((e) => e.principal)?.endereco ?? null,
          })
        }
      }
    }
    itens.sort((a, b) => a.dataAniversario.localeCompare(b.dataAniversario) || a.nome.localeCompare(b.nome, 'pt-BR'))
    return { itens, semDataNascimento: semData }
  }

  consultarCep(cep: string): Endereco | null {
    return CEPS_CONHECIDOS[apenasDigitos(cep)] ?? null
  }
}

const CEPS_CONHECIDOS: Record<string, Endereco> = {
  '01310100': {
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '',
    complemento: '',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
  },
  '20040020': {
    cep: '20040020',
    logradouro: 'Rua da Assembleia',
    numero: '',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
  },
}

export const bancoDoadores = new BancoDoadores()
