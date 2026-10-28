import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProvedorTema } from '../../app/ProvedorTema'
import { criarRoteadorEmMemoria } from '../../app/rotas'
import { AuthProvider } from '../../auth/AuthProvider'
import { authSimulado } from '../../auth/authSimulado'
import { USUARIOS_SIMULADOS } from '../../auth/usuariosSimulados'
import { bancoAdministracao } from '../../mocks/bancoAdministracao'
import { bancoDoadores } from '../../mocks/bancoDoadores'
import { bancoFinanceiro, CATEGORIAS, CONTAS, ORGANIZACAO } from '../../mocks/bancoFinanceiro'
import { valorMensalidade } from '../../mocks/tabelaMensalidade'
import { travaPeriodo } from '../../mocks/travaPeriodo'
import { formatarCompetencia, hoje, paraIsoData } from '../../shared/formatters/datas'
import { deslocarMes } from '../editoras/regras'
import { nomeDoMes } from '../financeiro/regras'

function renderizar(usuarioId: string, entrada: string) {
  authSimulado.entrar(usuarioId)
  return render(
    <ProvedorTema>
      <AuthProvider>
        <RouterProvider router={criarRoteadorEmMemoria([entrada])} />
      </AuthProvider>
    </ProvedorTema>,
  )
}

const ADMIN = 'u-admin'
const admin = USUARIOS_SIMULADOS.find((u) => u.id === ADMIN)!
const MES_ATUAL = paraIsoData(hoje()).slice(0, 7)

describe('Painel do Administrador (wireframe 4, US-ADMIN-021)', () => {
  it('mostra indicadores, atalhos, aprovações por tipo e a mensalidade agendada', async () => {
    bancoAdministracao.agendar(admin, null, { valor: 65, vigenteDe: deslocarMes(MES_ATUAL, 2), motivo: 'Reajuste anual' })
    renderizar(ADMIN, '/')
    expect(await screen.findByRole('heading', { name: 'Visão geral da organização' })).toBeInTheDocument()
    expect(screen.getByText('Doadores ativos')).toBeInTheDocument()
    expect(screen.getByText('Vendas no mês')).toBeInTheDocument()
    expect(screen.getByText('Resultado do mês')).toBeInTheDocument()
    const atalhos = screen.getByRole('navigation', { name: 'Atalhos do Administrador' })
    for (const nome of ['Gerenciar usuários', 'Plano de contas', 'Configurar mensagens', 'Fechamento mensal', 'Nova remessa', 'Novo título', 'Editoras', 'Relatórios']) {
      expect(within(atalhos).getByRole('link', { name: new RegExp(nome) })).toBeInTheDocument()
    }
    expect(screen.getByRole('tab', { name: /Baixas \(\d+\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Preços/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Inativações/ })).toBeInTheDocument()
    expect(await screen.findByText(new RegExp(`a partir de ${formatarCompetencia(deslocarMes(MES_ATUAL, 2)).replace('/', '\\/')}`))).toBeInTheDocument()
  })

  it('o menu do Administrador tem Configurações e as telas são só dele', async () => {
    renderizar(ADMIN, '/administracao')
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Configurações/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Importação do histórico/ })).toBeInTheDocument()
  })

  it('o Operador não abre as configurações', async () => {
    renderizar('u-operador', '/administracao/mensalidade')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Valor da mensalidade' })).not.toBeInTheDocument())
  })
})

describe('Usuários (US-ADMIN-001)', () => {
  it('lista papéis, sem editar', async () => {
    renderizar(ADMIN, '/administracao/usuarios')
    const tabela = await screen.findByRole('table', { name: 'Usuários do DurvalCRM' })
    const ana = within(tabela).getByText('Ana Operadora').closest('tr')!
    expect(within(ana).getByText('Operador')).toBeInTheDocument()
    expect(within(tabela).getAllByRole('link', { name: /Gerenciar no Keycloak/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Excluir|Novo usuário/ })).not.toBeInTheDocument()
  })
})

describe('Valor da mensalidade (US-ADMIN-002)', () => {
  it('agenda um novo valor só para os meses seguintes e mantém o passado', async () => {
    const usuario = userEvent.setup()
    renderizar(ADMIN, '/administracao/mensalidade')
    await usuario.click(await screen.findByRole('button', { name: 'Definir novo valor' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/Novo valor/), '60,00')
    await usuario.type(within(dialogo).getByLabelText(/Motivo/), 'Reajuste aprovado em assembleia')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    const proximo = deslocarMes(MES_ATUAL, 1)
    expect(await screen.findByText(new RegExp(`Novo valor de R\\$\\s60,00 a partir de ${formatarCompetencia(proximo).replace('/', '\\/')}`))).toBeInTheDocument()
    expect(valorMensalidade(proximo)).toBe(60)
    expect(valorMensalidade(MES_ATUAL)).toBe(50)
    // Só um agendamento por vez: agora ele é alterado ou cancelado.
    expect(screen.queryByRole('button', { name: 'Definir novo valor' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar agendamento' }))
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar agendamento' }))
    expect(await screen.findByText('Agendamento cancelado.')).toBeInTheDocument()
    expect(valorMensalidade(proximo)).toBe(50)
  })

  it('não aceita o mês atual', async () => {
    const usuario = userEvent.setup()
    renderizar(ADMIN, '/administracao/mensalidade')
    await usuario.click(await screen.findByRole('button', { name: 'Definir novo valor' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.type(within(dialogo).getByLabelText(/Novo valor/), '70')
    // O mês atual e os anteriores ficam indisponíveis no seletor; o ano atual só aparece se ainda houver mês permitido nele.
    const [ano, mes] = MES_ATUAL.split('-')
    await usuario.selectOptions(within(dialogo).getByLabelText('A partir de (ano)'), deslocarMes(MES_ATUAL, 1).slice(0, 4))
    if (deslocarMes(MES_ATUAL, 1).startsWith(ano)) {
      const opcao = within(within(dialogo).getByLabelText('A partir de (mês)')).getByRole('option', { name: nomeDoMes(MES_ATUAL).split('/')[0] })
      expect(opcao).toBeDisabled()
      expect(opcao).toHaveValue(mes)
    }
    expect(within(dialogo).getByLabelText('A partir de (mês)')).toHaveValue(deslocarMes(MES_ATUAL, 1).slice(5))
  })
})

describe('Modelos de mensagem (US-ADMIN-003)', () => {
  it('insere variáveis pelos chips, pré-visualiza e bloqueia variável desconhecida', async () => {
    const usuario = userEvent.setup()
    renderizar(ADMIN, '/administracao/mensagens')
    await usuario.click(await screen.findByRole('tab', { name: 'Felicitação de aniversário' }))
    const whatsapp = screen.getByLabelText(/Texto do WhatsApp/)
    await usuario.clear(whatsapp)
    await usuario.type(whatsapp, 'Parabéns, ')
    await usuario.click(screen.getByRole('button', { name: '{nome}' }))
    expect(whatsapp).toHaveValue('Parabéns, {nome}')
    expect(screen.getByLabelText('Pré-visualização do WhatsApp')).toHaveTextContent('Parabéns, Maria da Silva')
    expect(screen.queryByRole('button', { name: '{recibo}' })).not.toBeInTheDocument()

    await usuario.type(whatsapp, ' {{doador}')
    expect(screen.getByText('Variável desconhecida: {doador}.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar modelo' })).toBeDisabled()

    await usuario.clear(whatsapp)
    await usuario.type(whatsapp, 'Feliz aniversário, {{nome}!')
    await usuario.click(screen.getByRole('button', { name: 'Salvar modelo' }))
    expect(await screen.findByText(/Modelo salvo/)).toBeInTheDocument()
    expect(bancoAdministracao.modelos().find((m) => m.tipo === 'ANIVERSARIO')!.whatsapp).toBe('Feliz aniversário, {nome}!')
  })
})

describe('Plano de contas (US-ADMIN-004)', () => {
  it('inclui subcategoria com o tipo da mãe; Sistema não se inativa; usada não se exclui', async () => {
    const usuario = userEvent.setup()
    bancoFinanceiro.lancarManual(admin, {
      contaId: 1,
      data: paraIsoData(hoje()),
      tipo: 'RECEITA',
      categoria: 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS',
      valor: 10,
      descricao: 'Bazar',
      anexo: null,
      chaveIdempotencia: '',
    })
    renderizar(ADMIN, '/administracao/plano-contas')
    const tabela = await screen.findByRole('table', { name: 'Plano de contas' })
    const outrasDespesas = within(tabela).getByText('Outras despesas').closest('tr')!
    await usuario.click(within(outrasDespesas).getByRole('button', { name: 'Subcategoria' }))
    await usuario.type(within(screen.getByRole('dialog')).getByLabelText(/Nome/), 'Material gráfico')
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Incluir' }))
    expect(await screen.findByText('Material gráfico incluída.')).toBeInTheDocument()
    expect(CATEGORIAS.find((c) => c.nome === 'Material gráfico')).toMatchObject({ codigo: 'OUTRAS_DESPESAS.MATERIAL_GRAFICO', tipo: 'DESPESA' })

    const taxas = within(tabela).getByText('Taxas de cartão').closest('tr')!
    expect(within(taxas).getByText('Sistema')).toBeInTheDocument()
    expect(within(taxas).queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument()
    const outrasEntradas = within(tabela).getByText('Outras entradas').closest('tr')!
    expect(within(outrasEntradas).getByText('Em uso')).toBeInTheDocument()
    expect(within(outrasEntradas).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()

    await usuario.click(within(outrasEntradas).getByRole('button', { name: 'Inativar' }))
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Inativar' }))
    expect(await screen.findByText('Inativadas: Outras entradas.')).toBeInTheDocument()
    expect(bancoFinanceiro.categorias().find((c) => c.codigo === 'OUTRAS_RECEITAS.OUTRAS_ENTRADAS')!.ativa).toBe(false)
  })
})

describe('Dados da organização (US-ADMIN-005)', () => {
  it('valida o CNPJ e os novos dados valem para os próximos documentos', async () => {
    const usuario = userEvent.setup()
    renderizar(ADMIN, '/administracao/organizacao')
    expect(await screen.findByText('Dados da instalação')).toBeInTheDocument()
    const cnpj = screen.getByLabelText(/CNPJ/)
    await usuario.type(cnpj, '11.222.333/0001-82')
    expect(screen.getByText('CNPJ inválido.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    await usuario.clear(cnpj)
    await usuario.type(cnpj, '11.222.333/0001-81')
    const nome = screen.getByLabelText(/Nome de exibição/)
    await usuario.clear(nome)
    await usuario.type(nome, 'CE Cairbar Schutel')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
    // O formulário é remontado com os dados gravados; a mensagem fica na página.
    await waitFor(() => expect(screen.getByText(/Os próximos recibos/)).toBeInTheDocument())
    expect(ORGANIZACAO.nome).toBe('CE Cairbar Schutel')
    expect(ORGANIZACAO.cnpj).toBe('11.222.333/0001-81')
  })
})

describe('Auditoria (US-ADMIN-009)', () => {
  it('lista as ações com perfil e filtros, e o histórico aparece na página do doador', async () => {
    const usuario = userEvent.setup()
    bancoAdministracao.renomearCategoria(admin, 'administrador', 'OUTRAS_DESPESAS.EVENTOS', 'Eventos')
    renderizar(ADMIN, '/administracao/auditoria')
    const tabela = await screen.findByRole('table', { name: 'Registros de auditoria' })
    const linha = within(tabela).getByText('Categoria renomeada').closest('tr')!
    expect(within(linha).getByText('Administrador')).toBeInTheDocument()
    expect(within(linha).getByText(/Despesas com eventos → Eventos/)).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Usuário'), 'ninguém')
    expect(await screen.findByText('Nenhum registro com esses filtros.')).toBeInTheDocument()
  })

  it('aba Histórico do doador', async () => {
    const usuario = userEvent.setup()
    const doador = bancoDoadores.cadastrarRapido(
      { nome: 'Carlos Almeida', telefone: '11987650000', email: '', consentimentoWhatsapp: 'SIM', consentimentoEmail: 'NAO_INFORMADO', duplicatasDescartadas: [] },
      'Ana Operadora',
    )
    renderizar(ADMIN, `/doadores/${doador.id}`)
    await usuario.click(await screen.findByRole('button', { name: 'Histórico' }))
    expect(await within(screen.getByRole('dialog')).findByText('Doador cadastrado')).toBeInTheDocument()
  })
})

describe('Importação do histórico (US-ADMIN-012)', () => {
  function csv(conteudo: string, nome = 'historico.csv') {
    return new File([conteudo], nome, { type: 'text/csv' })
  }

  it('histórico financeiro antes do corte: prévia com totais, fecha os meses e pode ser desfeita', async () => {
    const usuario = userEvent.setup()
    for (const c of CONTAS) c.dataCorte = `${MES_ATUAL}-01`
    const mes = deslocarMes(MES_ATUAL, -2)
    renderizar(ADMIN, '/administracao/importacao')
    await usuario.upload(
      await screen.findByLabelText('Planilha CSV'),
      csv(`Data;Conta;Tipo;Subcategoria;Descrição;Valor\n10/${mes.slice(5)}/${mes.slice(0, 4)};Caixa Secretaria;Receita;Receitas de contribuições › Mensalidades;Mensalidades;1.250,00\n`),
    )
    const totais = await screen.findByRole('table', { name: 'Totais por conta' })
    expect(within(totais).getByText('Caixa Secretaria')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Meses que entram fechados: ${formatarCompetencia(mes).replace('/', '\\/')}`))).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar' }))
    expect(await screen.findByText('historico.csv: 1 lançamento(s) importado(s).')).toBeInTheDocument()
    expect(travaPeriodo.estaFechado(mes)).toBe(true)
    expect(bancoFinanceiro.saldo(1)).toBe(0)

    const historico = screen.getByRole('table', { name: 'Importações realizadas' })
    await usuario.click(within(historico).getByRole('button', { name: 'Desfazer' }))
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByText('Importação de historico.csv desfeita.')).toBeInTheDocument()
    expect(travaPeriodo.estaFechado(mes)).toBe(false)
  })

  it('erros por linha impedem a importação inteira', async () => {
    const usuario = userEvent.setup()
    renderizar(ADMIN, '/administracao/importacao')
    await usuario.upload(
      await screen.findByLabelText('Planilha CSV'),
      csv('Data;Conta;Tipo;Subcategoria;Descrição;Valor\n31/02/2026;Caixa X;Receita;Mensalidades;Teste;abc\n'),
    )
    const erros = await screen.findByRole('table', { name: 'Erros por linha' })
    expect(within(erros).getByText('Informe a data como dd/mm/aaaa.')).toBeInTheDocument()
    expect(within(erros).getByText(/Conta "Caixa X" não encontrada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
  })

  it('doadores: possível duplicata precisa de decisão', async () => {
    const usuario = userEvent.setup()
    bancoDoadores.cadastrarRapido(
      { nome: 'Maria da Silva', telefone: '11987654321', email: '', consentimentoWhatsapp: 'SIM', consentimentoEmail: 'NAO_INFORMADO', duplicatasDescartadas: [] },
      'Ana Operadora',
    )
    renderizar(ADMIN, '/administracao/importacao')
    await usuario.click(await screen.findByRole('tab', { name: 'Doadores' }))
    await usuario.upload(
      screen.getByLabelText('Planilha CSV'),
      csv(
        'Nome;Telefone;E-mail;Data de nascimento;CPF;Consentimento WhatsApp;Consentimento e-mail;Competências pendentes\n' +
          'Maria da Silva;(11) 98765-4321;;;;Sim;;\nJoão Pereira Lima;;joao@exemplo.com;;;;Sim;\n',
        'doadores.csv',
      ),
    )
    const duplicatas = await screen.findByRole('table', { name: 'Possíveis duplicatas' })
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
    await usuario.click(within(duplicatas).getByLabelText('Ignorar'))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Importar' }))
    expect(await screen.findByText('doadores.csv: 1 doador(es) importado(s).')).toBeInTheDocument()
    expect(bancoDoadores.buscar('João Pereira').length).toBe(1)
  })
})
