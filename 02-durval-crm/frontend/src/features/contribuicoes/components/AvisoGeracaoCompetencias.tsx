import { Aviso } from '../../../shared/components/Aviso'
import { formatarCompetencia, formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { contribuicaoService } from '../services'

/** US-CONTRIB-001: aviso nos painéis do Tesoureiro e do Administrador até a geração dar certo. */
export function AvisoGeracaoCompetencias() {
  const { dados } = useCarregamento(() => contribuicaoService.situacaoGeracao(), [])
  if (!dados || dados.estado !== 'FALHA') return null
  return (
    <Aviso tipo="warning" titulo="Falha na geração das competências">
      A geração das competências de {formatarCompetencia(dados.mes)} falhou ({dados.tentativas}{' '}
      {dados.tentativas === 1 ? 'tentativa' : 'tentativas'}, a última em{' '}
      {formatarDataHora(dados.ultimaTentativa)}). Uma nova tentativa é feita automaticamente a
      cada 15 minutos.
    </Aviso>
  )
}
