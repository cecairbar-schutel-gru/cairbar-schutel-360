import { Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useRef, useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { invalidarModelosMensagem } from '../hooks/useModeloMensagem'
import { LIMITES_MODELO, preVisualizar, variaveisDesconhecidas } from '../regras'
import { ROTULO_MODELO } from '../rotulos'
import { administracaoService } from '../services'
import type { ModeloMensagem, TextosModelo, TipoModelo } from '../types'

type Campo = keyof TextosModelo

const Colunas = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
  gap: theme.spacing(3),
  alignItems: 'start',
}))

const Previa = styled('div')(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  border: `1px solid ${theme.palette.divider}`,
}))

/**
 * Modelos de mensagem (US-ADMIN-003): agradecimento de contribuição e felicitação de aniversário,
 * cada um com o texto do WhatsApp e o assunto e corpo do e-mail; variáveis em chips clicáveis,
 * pré-visualização com dados de exemplo e variável desconhecida apontada antes de salvar.
 */
export function ModelosMensagemPage() {
  const modelos = useCarregamento(() => administracaoService.modelos(), [])
  const organizacao = useCarregamento(() => administracaoService.organizacao(), [])
  const [tipo, setTipo] = useState<TipoModelo>('AGRADECIMENTO')
  const [mensagem, setMensagem] = useState<string | null>(null)
  if (modelos.carregando && !modelos.dados) return <Carregando />
  if (modelos.erro || !modelos.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {modelos.erro ?? 'Não foi possível carregar os modelos.'}
      </Aviso>
    )
  }
  const modelo = modelos.dados.find((m) => m.tipo === tipo)!
  return (
    <Pilha component="section" aria-labelledby="titulo-modelos">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-modelos">Modelos de mensagem</TituloPagina>
      <TextoSuave>
        Usados ao preparar o agradecimento depois de uma contribuição e as felicitações dos aniversariantes. O Operador
        ainda pode ajustar o texto antes de enviar.
      </TextoSuave>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      <Tabs
        value={tipo}
        onChange={(_, v: TipoModelo) => {
          setTipo(v)
          setMensagem(null)
        }}
        aria-label="Tipo de modelo"
      >
        {modelos.dados.map((m) => (
          <Tab key={m.tipo} value={m.tipo} label={ROTULO_MODELO[m.tipo]} />
        ))}
      </Tabs>
      <EditorModelo
        key={`${modelo.tipo}-${modelo.atualizadoEm ?? ''}`}
        modelo={modelo}
        organizacao={organizacao.dados?.nomeExibicao ?? 'nossa organização'}
        onSalvo={() => {
          setMensagem('Modelo salvo. As próximas mensagens usam o novo texto.')
          modelos.recarregar()
        }}
      />
    </Pilha>
  )
}

function EditorModelo({ modelo, organizacao, onSalvo }: { modelo: ModeloMensagem; organizacao: string; onSalvo(): void }) {
  const [textos, setTextos] = useState<TextosModelo>({
    whatsapp: modelo.whatsapp,
    emailAssunto: modelo.emailAssunto,
    emailCorpo: modelo.emailCorpo,
  })
  const [focado, setFocado] = useState<Campo>('whatsapp')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const refs = {
    whatsapp: useRef<HTMLTextAreaElement | HTMLInputElement | null>(null),
    emailAssunto: useRef<HTMLTextAreaElement | HTMLInputElement | null>(null),
    emailCorpo: useRef<HTMLTextAreaElement | HTMLInputElement | null>(null),
  }
  const problemas = (Object.keys(textos) as Campo[]).reduce<Partial<Record<Campo, string>>>((acc, campo) => {
    const texto = textos[campo]
    const desconhecidas = variaveisDesconhecidas(texto, modelo.variaveis)
    if (!texto.trim()) acc[campo] = 'Preencha o texto.'
    else if (texto.length > LIMITES_MODELO[campo]) acc[campo] = `Use no máximo ${LIMITES_MODELO[campo]} caracteres.`
    else if (desconhecidas.length > 0) acc[campo] = `Variável desconhecida: ${desconhecidas.join(', ')}.`
    return acc
  }, {})
  const alterado = textos.whatsapp !== modelo.whatsapp || textos.emailAssunto !== modelo.emailAssunto || textos.emailCorpo !== modelo.emailCorpo

  function inserir(variavel: string) {
    const elemento = refs[focado].current
    const atual = textos[focado]
    const inicio = elemento?.selectionStart ?? atual.length
    const fim = elemento?.selectionEnd ?? atual.length
    const trecho = `{${variavel}}`
    setTextos({ ...textos, [focado]: atual.slice(0, inicio) + trecho + atual.slice(fim) })
    requestAnimationFrame(() => {
      elemento?.focus()
      elemento?.setSelectionRange(inicio + trecho.length, inicio + trecho.length)
    })
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      await administracaoService.salvarModelo(modelo.tipo, textos)
      invalidarModelosMensagem()
      onSalvo()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setSalvando(false)
    }
  }

  const campo = (nome: Campo, rotulo: string, linhas: number) => (
    <TextField
      label={rotulo}
      value={textos[nome]}
      onChange={(e) => setTextos({ ...textos, [nome]: e.target.value })}
      onFocus={() => setFocado(nome)}
      inputRef={refs[nome]}
      multiline={linhas > 1}
      minRows={linhas}
      error={!!problemas[nome]}
      helperText={problemas[nome] ?? `${textos[nome].length}/${LIMITES_MODELO[nome]}`}
      fullWidth
      required
    />
  )

  return (
    <Pilha>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      <Box>
        <Typography variant="subtitle2" component="p" gutterBottom>
          Variáveis (clique para inserir no campo selecionado)
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {modelo.variaveis.map((v) => (
            <Chip key={v} label={`{${v}}`} onClick={() => inserir(v)} color="primary" variant="outlined" />
          ))}
        </Stack>
      </Box>
      <Colunas>
        <Pilha spacing={2}>
          {campo('whatsapp', 'Texto do WhatsApp', 4)}
          {campo('emailAssunto', 'Assunto do e-mail', 1)}
          {campo('emailCorpo', 'Corpo do e-mail', 6)}
          <Box>
            <Button variant="contained" disabled={!alterado || Object.keys(problemas).length > 0 || salvando} onClick={() => void salvar()}>
              Salvar modelo
            </Button>
          </Box>
          {modelo.atualizadoEm && (
            <TextoSuave>
              Alterado por {modelo.atualizadoPor} em {formatarDataHora(modelo.atualizadoEm)}.
            </TextoSuave>
          )}
        </Pilha>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Pré-visualização
            </Typography>
            <TextoSuave>Com dados de exemplo.</TextoSuave>
            <Typography variant="subtitle2" component="h3" sx={{ mt: 2 }}>
              WhatsApp
            </Typography>
            <Previa aria-label="Pré-visualização do WhatsApp">{preVisualizar(textos.whatsapp, organizacao)}</Previa>
            <Typography variant="subtitle2" component="h3" sx={{ mt: 2 }}>
              E-mail
            </Typography>
            <Previa aria-label="Pré-visualização do e-mail">
              <strong>{preVisualizar(textos.emailAssunto, organizacao)}</strong>
              {'\n\n'}
              {preVisualizar(textos.emailCorpo, organizacao)}
            </Previa>
          </CardContent>
        </Card>
      </Colunas>
    </Pilha>
  )
}
