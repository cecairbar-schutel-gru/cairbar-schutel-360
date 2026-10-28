import { Alert, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { Assinaturas, BotaoImprimir, CabecalhoDocumento, EstiloImpressao } from '../components/Impressao'
import { TabelaAlocacao } from '../components/TabelaAlocacao'
import { ROTULO_MEIO } from '../rotulos'
import { editoraService } from '../services'

/** Recibo do pagamento a editora (US-PUBLISHER-008): valor, data e obrigações cobertas. */
export function ReciboPagamentoPage() {
  const id = Number(useParams().id)
  const { dados: r, carregando, erro } = useCarregamento(() => editoraService.recibo(id), [id])
  if (carregando && !r) return <Carregando linhas={6} />
  if (erro || !r) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Pagamento não encontrado.'}</Aviso>
  return (
    <Pilha component="section" aria-label={`Recibo do pagamento nº ${r.id}`}>
      <EstiloImpressao />
      <LinhaAcoes data-nao-imprimir sx={{ justifyContent: 'space-between' }}>
        <LinkRota to={`/editoras/${r.editoraId}/saldo`}>Voltar ao saldo da editora</LinkRota>
        <BotaoImprimir />
      </LinhaAcoes>
      {r.estornadoEm && (
        <Alert severity="warning" variant="outlined">
          Pagamento estornado em {formatarDataHora(r.estornadoEm)}: as obrigações cobertas voltaram a ficar em aberto.
        </Alert>
      )}
      <CabecalhoDocumento organizacao={r.organizacao} titulo={`Recibo de pagamento nº ${r.id}`} editoraNome={r.editoraNome} editoraCnpj={r.editoraCnpj} />
      <Typography variant="h4" component="p">
        {formatarMoeda(r.valor)}
      </Typography>
      <Typography>
        Pago em {formatarData(r.pagoEm)} por {ROTULO_MEIO[r.meio]} de {r.contaNome}
        {r.creditoAplicado > 0 && `, mais ${formatarMoeda(r.creditoAplicado)} de crédito da editora`}.
      </Typography>
      {r.observacao && <TextoSuave>Observação: {r.observacao}</TextoSuave>}
      <Typography variant="h6" component="h2">
        Obrigações cobertas
      </Typography>
      <TabelaAlocacao alocacoes={r.alocacoes} rotulo="Obrigações cobertas" rotuloAberto="Valor" rotuloRestante="Em aberto hoje" />
      <TextoSuave>
        Registrado por {r.registradoPor} em {formatarDataHora(r.registradoEm)}
        {r.lancamentoId && ` · despesa nº ${r.lancamentoId}`}.
      </TextoSuave>
      <Assinaturas esquerda={r.organizacao.nome} direita={r.editoraNome} />
    </Pilha>
  )
}
