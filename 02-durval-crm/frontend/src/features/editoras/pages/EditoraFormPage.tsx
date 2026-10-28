import { Button, TextField } from '@mui/material'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Fieldset, GradeForm, Legenda, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { apenasDigitos, formatarTelefone } from '../../../shared/formatters/formatadores'
import { validarEmail } from '../../../shared/validators/validadores'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { formatarCnpj, validarCnpj } from '../regras'
import { editoraService } from '../services'
import type { DadosEditora } from '../types'

const VAZIO: DadosEditora = {
  nome: '',
  cnpj: '',
  contatoNome: '',
  telefone: '',
  email: '',
  banco: '',
  agencia: '',
  conta: '',
  chavePix: '',
  observacoes: '',
}

/** Cadastro e alteração de editora (US-PUBLISHER-001, só Administrador): CNPJ validado e único. */
export function EditoraFormPage() {
  const { id } = useParams()
  const editoraId = id ? Number(id) : null
  const navegar = useNavigate()
  const [campos, setCampos] = useState<DadosEditora>(VAZIO)
  const [carregando, setCarregando] = useState(editoraId !== null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const alterar = (parcial: Partial<DadosEditora>) => setCampos((c) => ({ ...c, ...parcial }))

  useEffect(() => {
    if (editoraId === null) return
    editoraService.editora(editoraId).then(
      ({ editora: e }) => {
        setCampos({
          nome: e.nome,
          cnpj: formatarCnpj(e.cnpj ?? ''),
          contatoNome: e.contatoNome ?? '',
          telefone: e.telefone ? formatarTelefone(e.telefone) : '',
          email: e.email ?? '',
          banco: e.banco ?? '',
          agencia: e.agencia ?? '',
          conta: e.conta ?? '',
          chavePix: e.chavePix ?? '',
          observacoes: e.observacoes ?? '',
        })
        setCarregando(false)
      },
      (falha) => {
        setErro(mensagemDeErro(falha))
        setCarregando(false)
      },
    )
  }, [editoraId])

  if (carregando) return <Carregando />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!campos.nome.trim()) locais.nome = 'Informe o nome da editora.'
    if (!campos.cnpj.trim()) locais.cnpj = 'Informe o CNPJ.'
    else if (!validarCnpj(campos.cnpj)) locais.cnpj = 'CNPJ inválido.'
    const telefone = apenasDigitos(campos.telefone)
    if (telefone && (telefone.length < 10 || telefone.length > 11)) locais.telefone = 'Informe o telefone com DDD.'
    if (campos.email.trim() && !validarEmail(campos.email.trim())) locais.email = 'E-mail inválido.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setErro(null)
    setEnviando(true)
    try {
      const salva = editoraId === null ? await editoraService.cadastrar(campos) : await editoraService.alterar(editoraId, campos)
      navegar(`/editoras/${salva.id}`)
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  // Dados da editora, não do usuário: sem autopreenchimento do navegador, e o rótulo sobe sempre que há valor
  // (P13 da simulação de 27/10/2026: valor preenchido fora do React deixava o rótulo sobre o texto).
  const campo = (
    nome: keyof DadosEditora,
    rotulo: string,
    { htmlInput, ...extra }: Partial<Parameters<typeof TextField>[0]> & { htmlInput?: Record<string, unknown> } = {},
  ) => (
    <TextField
      label={rotulo}
      value={campos[nome]}
      onChange={(e) => alterar({ [nome]: e.target.value })}
      error={!!erros[nome] || !!erros[`pagamento.${nome}`]}
      helperText={erros[nome] ?? erros[`pagamento.${nome}`] ?? ' '}
      autoComplete="off"
      slotProps={{ htmlInput, inputLabel: { shrink: campos[nome] !== '' || undefined } }}
      {...extra}
    />
  )
  return (
    <Pilha component="section" aria-labelledby="titulo-form-editora">
      <LinkRota to={editoraId === null ? '/editoras' : `/editoras/${editoraId}`}>Voltar</LinkRota>
      <TituloPagina id="titulo-form-editora">{editoraId === null ? 'Nova editora' : 'Alterar editora'}</TituloPagina>
      <TextoSuave>As remessas, obrigações e pagamentos ficam ligados à editora pelo cadastro.</TextoSuave>
      {erro && <Aviso tipo="error" titulo="Não foi possível salvar">{erro}</Aviso>}
      <Pilha component="form" onSubmit={enviar} noValidate spacing={2} aria-label="Dados da editora">
        <Fieldset>
          <Legenda>Identificação</Legenda>
          <GradeForm>
            {campo('nome', 'Nome', { required: true, htmlInput: { maxLength: 200 } })}
            {campo('cnpj', 'CNPJ', { required: true, htmlInput: { inputMode: 'numeric' } })}
          </GradeForm>
        </Fieldset>
        <Fieldset>
          <Legenda>Contato</Legenda>
          <GradeForm>
            {campo('contatoNome', 'Nome do contato')}
            {campo('telefone', 'Telefone', { htmlInput: { inputMode: 'tel' } })}
            {campo('email', 'E-mail', { type: 'email' })}
          </GradeForm>
        </Fieldset>
        <Fieldset>
          <Legenda>Dados para pagamento</Legenda>
          <GradeForm>
            {campo('banco', 'Banco')}
            {campo('agencia', 'Agência')}
            {campo('conta', 'Conta')}
            {campo('chavePix', 'Chave PIX')}
          </GradeForm>
        </Fieldset>
        {campo('observacoes', 'Observações', { multiline: true, minRows: 2, htmlInput: { maxLength: 1000 } })}
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={enviando}>
            Salvar
          </Button>
          <Button onClick={() => navegar(-1)}>Cancelar</Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
