import {
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import {
  GradeForm,
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import { formatarTelefone } from '../../../shared/formatters/formatadores'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import {
  validarEmail,
  validarTelefone,
} from '../../../shared/validators/validadores'
import { ConsentimentoSelect } from '../components/ConsentimentoSelect'
import { errosPorCampo } from '../components/errosDeCampo'
import { StatusTag } from '../components/StatusTag'
import { ROTULO_DUPLICIDADE } from '../rotulos'
import { doadorService } from '../services'
import type { PossivelDuplicata, ValorConsentimento } from '../types'

function separarTermo(termo: string): {
  nome: string
  telefone: string
  email: string
} {
  const t = termo.trim()
  if (t.includes('@')) return { nome: '', telefone: '', email: t }
  if (/^[\d\s()+-]+$/.test(t) && t.replace(/\D/g, '').length >= 3)
    return { nome: '', telefone: t, email: '' }
  return { nome: t, telefone: '', email: '' }
}

export function CadastroRapidoPage() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const inicial = separarTermo(params.get('q') ?? '')
  const [nome, setNome] = useState(inicial.nome)
  const [telefone, setTelefone] = useState(inicial.telefone)
  const [email, setEmail] = useState(inicial.email)
  const [whatsapp, setWhatsapp] = useState<ValorConsentimento>('NAO_INFORMADO')
  const [consentEmail, setConsentEmail] =
    useState<ValorConsentimento>('NAO_INFORMADO')
  const [encontradas, setDuplicatas] = useState<PossivelDuplicata[]>([])
  const [descartadas, setDescartadas] = useState<number[]>([])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [falha, setFalha] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const dados = useDebounce({ nome, telefone, email }, 400)
  const semConteudo =
    dados.nome.trim().length < 3 &&
    !dados.telefone.trim() &&
    !dados.email.trim()
  const duplicatas = semConteudo ? [] : encontradas
  useEffect(() => {
    if (semConteudo) return
    let ativo = true
    doadorService.verificarDuplicatas(dados).then(
      (r) => ativo && setDuplicatas(r),
      () => ativo && setDuplicatas([]),
    )
    return () => {
      ativo = false
    }
  }, [dados, semConteudo])

  const pendentesDeDecisao = duplicatas.filter(
    (d) => !descartadas.includes(d.doador.id),
  )

  function validar(): Record<string, string> {
    const e: Record<string, string> = {}
    if (nome.trim().split(/\s+/).length < 2) e.nome = 'Informe o nome completo.'
    if (!telefone.trim() && !email.trim())
      e.telefone = 'Informe ao menos um contato: celular ou e-mail.'
    else {
      if (telefone.trim() && !validarTelefone(telefone))
        e.telefone = 'Telefone inválido. Informe DDD e 10 ou 11 dígitos.'
      if (email.trim() && !validarEmail(email)) e.email = 'E-mail inválido.'
    }
    return e
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setFalha(null)
    const locais = validar()
    setErros(locais)
    if (Object.keys(locais).length > 0 || pendentesDeDecisao.length > 0) return
    setSalvando(true)
    try {
      const criado = await doadorService.cadastrarRapido({
        nome,
        telefone,
        email,
        consentimentoWhatsapp: whatsapp,
        consentimentoEmail: consentEmail,
        duplicatasDescartadas: duplicatas
          .map((d) => d.doador.id)
          .filter((id) => descartadas.includes(id)),
      })
      navegar(`/contribuicoes/nova/${criado.id}`, { replace: true })
    } catch (erro) {
      setErros(errosPorCampo(erro))
      setFalha(mensagemDeErro(erro))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-cadastro">
      <TituloPagina id="titulo-cadastro">
        Cadastro rápido de doador
      </TituloPagina>
      <Pilha component="form" onSubmit={enviar} noValidate>
        <GradeForm>
          <TextField
            id="rapido-nome"
            label="Nome completo"
            autoComplete="off"
            slotProps={{ inputLabel: { shrink: nome !== '' || undefined } }}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={!!erros.nome}
            helperText={erros.nome}
            autoFocus
          />
          <TextField
            id="rapido-telefone"
            label="Celular com DDD"
            autoComplete="off"
            slotProps={{ htmlInput: { inputMode: 'tel' }, inputLabel: { shrink: telefone !== '' || undefined } }}
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            error={!!erros.telefone}
            helperText={erros.telefone}
          />
          <TextField
            id="rapido-email"
            label="E-mail"
            type="email"
            autoComplete="off"
            slotProps={{ inputLabel: { shrink: email !== '' || undefined } }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!erros.email}
            helperText={erros.email}
          />
        </GradeForm>

        {duplicatas.length > 0 && (
          <Pilha
            spacing={2}
            role="region"
            aria-label="Possíveis duplicidades"
            aria-live="polite"
          >
            <Aviso tipo="warning" titulo="Possível duplicidade">
              Confira se a pessoa já está cadastrada antes de continuar.
            </Aviso>
            {duplicatas.map(({ doador, motivos }) => {
              const decidido = descartadas.includes(doador.id)
              return (
                <Card key={doador.id} variant="outlined">
                  <CardContent>
                    <Pilha spacing={1.5}>
                      <LinhaAcoes>
                        <Typography component="strong" sx={{ fontWeight: 600 }}>
                          {doador.nome}
                        </Typography>
                        <StatusTag status={doador.status} />
                        {motivos.map((m) => (
                          <Chip
                            key={m}
                            size="small"
                            variant="outlined"
                            label={ROTULO_DUPLICIDADE[m]}
                          />
                        ))}
                      </LinhaAcoes>
                      <TextoSuave>
                        {formatarTelefone(doador.telefonePrincipal)} ·{' '}
                        {doador.emailPrincipal ?? 'sem e-mail'}
                      </TextoSuave>
                      <LinhaAcoes>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() =>
                            navegar(`/doadores/${doador.id}?acao=receber`)
                          }
                        >
                          Usar este doador
                        </Button>
                        <Button
                          size="small"
                          variant={decidido ? 'contained' : 'outlined'}
                          color={decidido ? 'inherit' : 'primary'}
                          aria-pressed={decidido}
                          onClick={() =>
                            setDescartadas((atual) =>
                              decidido
                                ? atual.filter((id) => id !== doador.id)
                                : [...atual, doador.id],
                            )
                          }
                        >
                          {decidido
                            ? 'Marcado: é outra pessoa'
                            : 'É outra pessoa'}
                        </Button>
                      </LinhaAcoes>
                    </Pilha>
                  </CardContent>
                </Card>
              )
            })}
          </Pilha>
        )}

        <GradeForm>
          <ConsentimentoSelect
            id="rapido-consent-whatsapp"
            rotulo="Consentimento para WhatsApp"
            valor={whatsapp}
            onChange={setWhatsapp}
          />
          <ConsentimentoSelect
            id="rapido-consent-email"
            rotulo="Consentimento para e-mail"
            valor={consentEmail}
            onChange={setConsentEmail}
          />
        </GradeForm>

        {pendentesDeDecisao.length > 0 && (
          <TextoSuave role="status">
            Decida cada possível duplicidade (“Usar este doador” ou “É outra
            pessoa”) para salvar.
          </TextoSuave>
        )}
        {falha && !Object.keys(erros).length && (
          <Aviso tipo="error" titulo="Não foi possível cadastrar">
            {falha}
          </Aviso>
        )}
        <LinhaAcoes>
          <Button
            type="submit"
            variant="contained"
            disabled={salvando || pendentesDeDecisao.length > 0}
          >
            {salvando ? 'Salvando…' : 'Salvar e receber contribuição'}
          </Button>
          <Button onClick={() => navegar('/doadores')}>Cancelar</Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
