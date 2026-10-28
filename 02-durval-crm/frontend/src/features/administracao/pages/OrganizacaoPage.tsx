import { Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarTelefone } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { validarEmail } from '../../../shared/validators/validadores'
import { erroChavePix, erroCidadePix, erroLogo, formatarCnpj, lerBase64, validarCnpj } from '../regras'
import { administracaoService } from '../services'
import { ROTULO_TIPO_CHAVE_PIX, type DadosOrganizacao, type Organizacao, type TipoChavePix } from '../types'

/**
 * Dados da organização (US-ADMIN-005) usados em recibos, comprovantes, apurações, relatórios e
 * exportações gerados depois da alteração (a segunda via de um recibo usa os dados atuais).
 */
export function OrganizacaoPage() {
  const organizacao = useCarregamento(() => administracaoService.organizacao(), [])
  const [mensagem, setMensagem] = useState<string | null>(null)
  if (organizacao.carregando && !organizacao.dados) return <Carregando />
  if (organizacao.erro || !organizacao.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {organizacao.erro ?? 'Não foi possível carregar os dados.'}
      </Aviso>
    )
  }
  return (
    <Formulario
      key={organizacao.dados.atualizadoEm ?? 'padrao'}
      atual={organizacao.dados}
      mensagem={mensagem}
      onMensagem={setMensagem}
      onSalvo={() => {
        setMensagem('Dados salvos. Os próximos recibos, comprovantes e relatórios usam os dados novos.')
        organizacao.recarregar()
      }}
    />
  )
}

function Formulario({
  atual,
  mensagem,
  onMensagem,
  onSalvo,
}: {
  atual: Organizacao
  mensagem: string | null
  onMensagem(m: string | null): void
  onSalvo(): void
}) {
  const { perfilAtivo } = useAuth()
  const admin = perfilAtivo === 'administrador'
  const [dados, setDados] = useState<DadosOrganizacao>({
    razaoSocial: atual.razaoSocial,
    nomeExibicao: atual.nomeExibicao,
    cnpj: formatarCnpj(atual.cnpj),
    endereco: atual.endereco ?? '',
    telefone: atual.telefone ? formatarTelefone(atual.telefone) : '',
    email: atual.email ?? '',
    rodapeRecibo: atual.rodapeRecibo ?? '',
    tipoChavePix: atual.tipoChavePix ?? '',
    chavePix: atual.chavePix ?? '',
    cidadePix: atual.cidadePix ?? '',
    logo: null,
    removerLogo: false,
  })
  const [logoAtual, setLogoAtual] = useState<string | null>(null)
  const [previaLogo, setPreviaLogo] = useState<string | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!atual.temLogo) return
    let url: string | null = null
    administracaoService.logo().then(
      (blob) => {
        if (blob) {
          url = URL.createObjectURL(blob)
          setLogoAtual(url)
        }
      },
      () => undefined,
    )
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [atual.temLogo])

  const erros: Partial<Record<keyof DadosOrganizacao, string>> = {}
  if (!dados.razaoSocial.trim()) erros.razaoSocial = 'Informe a razão social.'
  if (!dados.nomeExibicao.trim()) erros.nomeExibicao = 'Informe o nome de exibição.'
  if (dados.cnpj.trim() && !validarCnpj(dados.cnpj)) erros.cnpj = 'CNPJ inválido.'
  if (dados.email.trim() && !validarEmail(dados.email)) erros.email = 'E-mail inválido.'
  const digitosTelefone = dados.telefone.replace(/\D/g, '')
  if (digitosTelefone && (digitosTelefone.length < 10 || digitosTelefone.length > 11)) erros.telefone = 'Informe DDD e 10 ou 11 dígitos.'
  if (dados.tipoChavePix) {
    const erroChave = erroChavePix(dados.tipoChavePix, dados.chavePix)
    const erroCidade = erroCidadePix(dados.cidadePix)
    if (erroChave) erros.chavePix = erroChave
    if (erroCidade) erros.cidadePix = erroCidade
  } else if (dados.chavePix.trim()) {
    erros.tipoChavePix = 'Informe o tipo da chave PIX.'
  }

  async function escolherLogo(arquivo: File | undefined) {
    setErroArquivo(null)
    if (!arquivo) return
    const problema = erroLogo(arquivo)
    if (problema) {
      setErroArquivo(problema)
      return
    }
    setDados({ ...dados, logo: { conteudo: await lerBase64(arquivo), tipo: arquivo.type }, removerLogo: false })
    setPreviaLogo(URL.createObjectURL(arquivo))
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      await administracaoService.salvarOrganizacao(dados)
      onSalvo()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setSalvando(false)
    }
  }

  const campo = (nome: Exclude<keyof DadosOrganizacao, 'logo' | 'removerLogo' | 'tipoChavePix'>, rotulo: string, extra: object = {}) => (
    <TextField
      label={rotulo}
      value={dados[nome]}
      onChange={(e) => setDados({ ...dados, [nome]: e.target.value })}
      error={!!erros[nome]}
      helperText={erros[nome]}
      disabled={!admin}
      fullWidth
      {...extra}
    />
  )
  const imagem = dados.removerLogo ? null : (previaLogo ?? logoAtual)

  return (
    <Pilha component="section" aria-labelledby="titulo-organizacao">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-organizacao">Dados da organização</TituloPagina>
      <TextoSuave>
        Aparecem nos recibos de contribuição, comprovantes de venda, apurações das editoras, relatórios e exportações.
        Datas e a geração mensal usam o fuso {atual.fusoHorario}.
      </TextoSuave>
      {atual.padrao && (
        <Aviso tipo="info" titulo="Dados da instalação">
          Ainda valem os dados configurados na instalação. Revise e salve para mantê-los aqui.
        </Aviso>
      )}
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => onMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      <GradeForm>
        {campo('razaoSocial', 'Razão social', { required: true })}
        {campo('nomeExibicao', 'Nome de exibição', { required: true })}
        {campo('cnpj', 'CNPJ', { slotProps: { htmlInput: { inputMode: 'numeric' } } })}
        {campo('telefone', 'Telefone', { slotProps: { htmlInput: { inputMode: 'tel' } } })}
        {campo('email', 'E-mail', { type: 'email' })}
      </GradeForm>
      {campo('endereco', 'Endereço')}
      {campo('rodapeRecibo', 'Rodapé do recibo', { helperText: erros.rodapeRecibo ?? 'Ex.: um breve agradecimento.' })}
      <Box component="section" aria-labelledby="titulo-pix">
        <Typography variant="subtitle2" component="h2" id="titulo-pix" gutterBottom>
          PIX da cantina
        </Typography>
        <TextoSuave>
          O PDV da cantina gera o QR Code de cobrança com esta chave, o nome de exibição e a cidade. Sem chave, o
          PDV não oferece o QR Code.
        </TextoSuave>
        <Box sx={{ mt: 2 }}>
          <GradeForm>
            <TextField
              select
              label="Tipo da chave"
              value={dados.tipoChavePix}
              onChange={(e) => setDados({ ...dados, tipoChavePix: e.target.value as TipoChavePix | '' })}
              error={!!erros.tipoChavePix}
              helperText={erros.tipoChavePix}
              disabled={!admin}
              fullWidth
            >
              <MenuItem value="">Sem chave PIX</MenuItem>
              {(Object.keys(ROTULO_TIPO_CHAVE_PIX) as TipoChavePix[]).map((t) => (
                <MenuItem key={t} value={t}>
                  {ROTULO_TIPO_CHAVE_PIX[t]}
                </MenuItem>
              ))}
            </TextField>
            {campo('chavePix', 'Chave PIX', {
              slotProps: {
                htmlInput: {
                  inputMode:
                    dados.tipoChavePix === 'CPF' || dados.tipoChavePix === 'CNPJ'
                      ? 'numeric'
                      : dados.tipoChavePix === 'TELEFONE'
                        ? 'tel'
                        : dados.tipoChavePix === 'EMAIL'
                          ? 'email'
                          : 'text',
                },
              },
            })}
            {campo('cidadePix', 'Cidade (QR Code)', {
              helperText: erros.cidadePix ?? 'Até 15 caracteres, como no cadastro do banco.',
            })}
          </GradeForm>
        </Box>
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h2" gutterBottom>
          Logotipo
        </Typography>
        {imagem ? (
          <Box component="img" src={imagem} alt="Logotipo da organização" sx={{ maxHeight: 96, maxWidth: 240, display: 'block', mb: 1 }} />
        ) : (
          <TextoSuave>{atual.temLogo && !dados.removerLogo ? 'Carregando…' : 'Usando o logotipo da instalação.'}</TextoSuave>
        )}
        {admin && (
          <LinhaAcoes>
            <Button component="label" variant="outlined">
              Escolher arquivo
              <input hidden type="file" accept="image/png,image/jpeg" onChange={(e) => void escolherLogo(e.target.files?.[0])} />
            </Button>
            {(atual.temLogo || dados.logo) && !dados.removerLogo && (
              <Button
                color="error"
                onClick={() => {
                  setDados({ ...dados, logo: null, removerLogo: true })
                  setPreviaLogo(null)
                }}
              >
                Remover logotipo
              </Button>
            )}
            <TextoSuave>PNG ou JPG de até 1 MB.</TextoSuave>
          </LinhaAcoes>
        )}
        {erroArquivo && (
          <Typography variant="caption" color="error" role="alert">
            {erroArquivo}
          </Typography>
        )}
      </Box>
      {admin && (
        <Box>
          <Button variant="contained" disabled={Object.keys(erros).length > 0 || salvando} onClick={() => void salvar()}>
            Salvar
          </Button>
        </Box>
      )}
      {atual.atualizadoEm && (
        <TextoSuave>
          Alterado por {atual.atualizadoPor} em {formatarDataHora(atual.atualizadoEm)}.
        </TextoSuave>
      )}
    </Pilha>
  )
}
