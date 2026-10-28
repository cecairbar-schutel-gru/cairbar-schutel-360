import { useNavigate } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Pilha, TituloPagina } from '../../../shared/components/layout'
import { EtapaPagamento } from '../components/EtapaPagamento'

/** US-CONTRIB-008: sem busca de doador, sem competências e sem mensagem de agradecimento. */
export function DoacaoAnonimaPage() {
  const navegar = useNavigate()
  return (
    <Pilha component="section" aria-labelledby="titulo-anonima">
      <TituloPagina id="titulo-anonima">Doação anônima</TituloPagina>
      <Aviso tipo="info" titulo="Não vinculada a doador">
        O valor é registrado em Doações anônimas e o recibo sai como “Doação
        anônima”.
      </Aviso>
      <EtapaPagamento
        doador={null}
        competencias={[]}
        onVoltar={() => navegar('/')}
        onRegistrada={(r) => navegar(`/contribuicoes/${r.id}?nova=1`, { replace: true })}
      />
    </Pilha>
  )
}
