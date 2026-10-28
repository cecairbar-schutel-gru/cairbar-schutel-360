import { Button, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { mensagemDeErro, salvarArquivo } from '../../../shared/api/http'
import { useModeloMensagem } from '../../administracao/hooks/useModeloMensagem'
import { formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { linkEmail, linkWhatsApp, preencherModelo } from '../../../shared/text/mensagens'
import { doadorService } from '../../doadores/services'
import { listarCompetencias } from '../regras'
import { contribuicaoService } from '../services'
import type { CanalAgradecimento, Recibo } from '../types'

/**
 * US-CONTRIB-010: mensagem pré-preenchida só nos canais com consentimento; o envio é manual e o
 * PDF é baixado para ser anexado.
 */
export function AgradecimentoPanel({ recibo }: { recibo: Recibo }) {
  const { dados: doador, carregando, erro } = useCarregamento(
    () => doadorService.obter(recibo.doadorId!),
    [recibo.doadorId],
  )
  const variaveis = {
    nome: recibo.doadorNome.split(' ')[0],
    valor: formatarMoeda(recibo.total),
    competencias:
      recibo.competencias.length > 0
        ? listarCompetencias(recibo.competencias.map((c) => c.mes))
        : 'doação extraordinária',
    data: formatarDataHora(recibo.recebidaEm).slice(0, 10),
    recibo: recibo.numero,
    organizacao: recibo.organizacao.nome,
  }
  const { modelo, carregando: carregandoModelo } = useModeloMensagem('AGRADECIMENTO')
  const [whatsapp, setWhatsapp] = useState(preencherModelo(modelo.whatsapp, variaveis))
  const [assunto, setAssunto] = useState(preencherModelo(modelo.emailAssunto, variaveis))
  const [corpo, setCorpo] = useState(preencherModelo(modelo.emailCorpo, variaveis))
  const [falha, setFalha] = useState<string | null>(null)

  // US-ADMIN-003: o texto parte do modelo configurado pelo Administrador.
  useEffect(() => {
    if (carregandoModelo) return
    setWhatsapp(preencherModelo(modelo.whatsapp, variaveis))
    setAssunto(preencherModelo(modelo.emailAssunto, variaveis))
    setCorpo(preencherModelo(modelo.emailCorpo, variaveis))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoModelo])

  if (carregando || carregandoModelo) return <Carregando />
  if (erro || !doador) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Doador não encontrado.'}</Aviso>

  const telefone = doador.consentimentoWhatsapp.valor === 'SIM' ? doador.telefones.find((t) => t.principal)?.numero : undefined
  const email = doador.consentimentoEmail.valor === 'SIM' ? doador.emails.find((e) => e.principal)?.endereco : undefined

  /** Abre o canal ainda no clique (sem bloqueio de pop-up); PDF e registro seguem em paralelo. */
  function preparar(canal: CanalAgradecimento) {
    setFalha(null)
    if (canal === 'WHATSAPP') window.open(linkWhatsApp(telefone!, whatsapp), '_blank', 'noopener,noreferrer')
    else window.location.href = linkEmail(email!, assunto, corpo)
    void (async () => {
      try {
        salvarArquivo(await contribuicaoService.baixarReciboPdf(recibo.contribuicaoId, 'A4', false))
        await contribuicaoService.registrarMensagemPreparada(recibo.contribuicaoId, canal)
      } catch (e) {
        setFalha(mensagemDeErro(e))
      }
    })()
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-agradecer" spacing={2}>
      <Typography id="titulo-agradecer" variant="h6" component="h2">
        Agradecer doador
      </Typography>
      {!telefone && !email ? (
        <Aviso tipo="info" titulo="Sem canal autorizado">
          {doador.nome} não autorizou contato por WhatsApp nem por e-mail (ou não há contato
          principal cadastrado). Atualize o consentimento no perfil, se for o caso.
        </Aviso>
      ) : (
        <>
          <TextoSuave>
            O envio é manual: o PDF do recibo é baixado para você anexar à mensagem.
          </TextoSuave>
          {falha && <Aviso tipo="error" titulo="Erro">{falha}</Aviso>}
          {telefone && (
            <Pilha spacing={1}>
              <TextField label="Mensagem de WhatsApp" multiline minRows={3} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              <LinhaAcoes>
                <Button variant="outlined" onClick={() => preparar('WHATSAPP')}>
                  Abrir WhatsApp
                </Button>
              </LinhaAcoes>
            </Pilha>
          )}
          {email && (
            <Pilha spacing={1}>
              <TextField label="Assunto do e-mail" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              <TextField label="Corpo do e-mail" multiline minRows={4} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
              <LinhaAcoes>
                <Button variant="outlined" onClick={() => preparar('EMAIL')}>
                  Abrir e-mail
                </Button>
              </LinhaAcoes>
            </Pilha>
          )}
        </>
      )}
    </Pilha>
  )
}
