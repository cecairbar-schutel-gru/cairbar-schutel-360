import { Button, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import {
  apenasDigitos,
  formatarCep,
} from '../../../shared/formatters/formatadores'
import { dePartesIso, hoje } from '../../../shared/formatters/datas'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import {
  Fieldset,
  GradeForm,
  Legenda,
  LinhaAcoes,
  Pilha,
} from '../../../shared/components/layout'
import {
  validarCep,
  validarCpf,
  validarEmail,
  validarTelefone,
} from '../../../shared/validators/validadores'
import { doadorService } from '../services'
import type { Doador, Endereco, ValorConsentimento } from '../types'
import { ConsentimentoSelect } from './ConsentimentoSelect'
import { EmailsEditor, TelefonesEditor } from './ContatosEditor'
import { errosPorCampo } from './errosDeCampo'

const ENDERECO_VAZIO: Endereco = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

interface Props {
  doador: Doador
  somenteLeitura: boolean
  onSalvo(doador: Doador): void
}

export function DadosDoadorForm({ doador, somenteLeitura, onSalvo }: Props) {
  const [nome, setNome] = useState(doador.nome)
  const [cpf, setCpf] = useState(doador.cpf ?? '')
  const [nascimento, setNascimento] = useState(doador.dataNascimento ?? '')
  const [telefones, setTelefones] = useState(doador.telefones)
  const [emails, setEmails] = useState(doador.emails)
  const [endereco, setEndereco] = useState<Endereco>(
    doador.endereco ?? ENDERECO_VAZIO,
  )
  const [whatsapp, setWhatsapp] = useState<ValorConsentimento>(
    doador.consentimentoWhatsapp.valor,
  )
  const [email, setEmail] = useState<ValorConsentimento>(
    doador.consentimentoEmail.valor,
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [falha, setFalha] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const campoEndereco = (campo: keyof Endereco, valor: string) => {
    setEndereco((e) => ({ ...e, [campo]: valor }))
  }

  async function preencherPorCep() {
    if (!validarCep(endereco.cep)) return
    try {
      const encontrado = await doadorService.consultarCep(
        apenasDigitos(endereco.cep),
      )
      if (encontrado) {
        setEndereco((e) => ({
          ...e,
          logradouro: encontrado.logradouro,
          bairro: encontrado.bairro,
          cidade: encontrado.cidade,
          uf: encontrado.uf,
        }))
      }
    } catch {
      // consulta de CEP é opcional: o usuário pode preencher manualmente
    }
  }

  function validar(): Record<string, string> {
    const e: Record<string, string> = {}
    if (nome.trim().split(/\s+/).length < 2) e.nome = 'Informe o nome completo.'
    if (cpf.trim() && !validarCpf(cpf)) e.cpf = 'CPF inválido.'
    if (nascimento && dePartesIso(nascimento) > hoje()) {
      e.dataNascimento = 'A data de nascimento não pode ser futura.'
    }
    if (telefones.some((t) => !validarTelefone(t.numero))) {
      e.telefones = 'Há telefone inválido. Informe DDD e 10 ou 11 dígitos.'
    }
    if (emails.some((m) => !validarEmail(m.endereco)))
      e.emails = 'Há e-mail inválido.'
    if (endereco.cep.trim() && !validarCep(endereco.cep))
      e.cep = 'CEP deve ter 8 dígitos.'
    return e
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setSalvo(false)
    setFalha(null)
    const locais = validar()
    setErros(locais)
    if (Object.keys(locais).length > 0) return

    const temEndereco = Object.values(endereco).some((v) => v.trim() !== '')
    setSalvando(true)
    try {
      const atualizado = await doadorService.atualizar(doador.id, {
        nome,
        cpf,
        dataNascimento: nascimento,
        telefones,
        emails,
        endereco: temEndereco
          ? { ...endereco, cep: apenasDigitos(endereco.cep) }
          : null,
        consentimentoWhatsapp: whatsapp,
        consentimentoEmail: email,
      })
      setSalvo(true)
      onSalvo(atualizado)
    } catch (erro) {
      setErros(errosPorCampo(erro))
      setFalha(mensagemDeErro(erro))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Pilha
      component="form"
      onSubmit={enviar}
      noValidate
      aria-label="Dados do doador"
    >
      <Fieldset disabled={somenteLeitura}>
        <Legenda>Dados pessoais</Legenda>
        <GradeForm>
          <TextField
            id="doador-nome"
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={!!erros.nome}
            helperText={erros.nome}
          />
          <TextField
            id="doador-cpf"
            label="CPF (opcional)"
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            error={!!erros.cpf}
            helperText={erros.cpf}
          />
          <TextField
            id="doador-nascimento"
            label="Data de nascimento (opcional)"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            error={!!erros.dataNascimento}
            helperText={erros.dataNascimento}
          />
        </GradeForm>
      </Fieldset>

      <Fieldset disabled={somenteLeitura}>
        <TelefonesEditor
          telefones={telefones}
          erro={erros.telefones}
          onChange={setTelefones}
        />
        <EmailsEditor
          emails={emails}
          erro={erros.emails}
          onChange={setEmails}
        />
      </Fieldset>

      <Fieldset disabled={somenteLeitura}>
        <Legenda>Endereço (opcional)</Legenda>
        <GradeForm>
          <TextField
            id="end-cep"
            label="CEP"
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            value={endereco.cep}
            onChange={(e) => campoEndereco('cep', e.target.value)}
            onBlur={() => {
              void preencherPorCep()
              if (validarCep(endereco.cep))
                campoEndereco('cep', formatarCep(endereco.cep))
            }}
            error={!!erros.cep}
            helperText={erros.cep}
          />
          <TextField
            id="end-logradouro"
            label="Logradouro"
            value={endereco.logradouro}
            onChange={(e) => campoEndereco('logradouro', e.target.value)}
          />
          <TextField
            id="end-numero"
            label="Número"
            value={endereco.numero}
            onChange={(e) => campoEndereco('numero', e.target.value)}
          />
          <TextField
            id="end-complemento"
            label="Complemento"
            value={endereco.complemento}
            onChange={(e) => campoEndereco('complemento', e.target.value)}
          />
          <TextField
            id="end-bairro"
            label="Bairro"
            value={endereco.bairro}
            onChange={(e) => campoEndereco('bairro', e.target.value)}
          />
          <TextField
            id="end-cidade"
            label="Cidade"
            value={endereco.cidade}
            onChange={(e) => campoEndereco('cidade', e.target.value)}
          />
          <TextField
            id="end-uf"
            label="UF"
            slotProps={{ htmlInput: { maxLength: 2 } }}
            value={endereco.uf}
            onChange={(e) => campoEndereco('uf', e.target.value.toUpperCase())}
          />
        </GradeForm>
      </Fieldset>

      <Fieldset disabled={somenteLeitura}>
        <Legenda>Consentimento de contato</Legenda>
        <GradeForm>
          <ConsentimentoSelect
            id="consent-whatsapp"
            rotulo="WhatsApp"
            valor={whatsapp}
            registro={doador.consentimentoWhatsapp}
            onChange={setWhatsapp}
          />
          <ConsentimentoSelect
            id="consent-email"
            rotulo="E-mail"
            valor={email}
            registro={doador.consentimentoEmail}
            onChange={setEmail}
          />
        </GradeForm>
      </Fieldset>

      {falha && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {falha}
        </Aviso>
      )}
      {salvo && (
        <Aviso tipo="success" titulo="Dados salvos">
          O perfil do doador foi atualizado.
        </Aviso>
      )}
      {!somenteLeitura && (
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </LinhaAcoes>
      )}
    </Pilha>
  )
}
