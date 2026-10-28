import { Button, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  LinhaAcoes,
  Pilha,
  TextoSuave,
  TituloPagina,
} from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { doadorService } from '../../doadores/services'
import { BuscaDoadorPasso } from '../components/BuscaDoadorPasso'
import { EtapaPagamento } from '../components/EtapaPagamento'
import { PassosContribuicao } from '../components/PassosContribuicao'
import { SelecaoCompetencias } from '../components/SelecaoCompetencias'
import { competenciaService } from '../services'
import type { ContribuicaoRegistrada } from '../types'

/**
 * Receber contribuição (Jornada A, US-CONTRIB-003 a 007). Vindo do perfil, o passo 1 já está
 * feito; com `?doacao=1`, vai direto ao pagamento sem competências (doação extraordinária).
 */
export function RegistrarContribuicaoPage() {
  const { doadorId } = useParams()
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const id = doadorId ? Number(doadorId) : null
  const somenteDoacao = params.get('doacao') === '1'
  const [passo, setPasso] = useState(id === null ? 0 : somenteDoacao ? 2 : 1)
  const [selecionadas, setSelecionadas] = useState<string[]>([])

  function concluir(r: ContribuicaoRegistrada) {
    navegar(`/contribuicoes/${r.id}?nova=1`, { replace: true })
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-contribuicao">
      <TituloPagina id="titulo-contribuicao">
        {somenteDoacao ? 'Registrar doação' : 'Receber contribuição'}
      </TituloPagina>
      <PassosContribuicao ativo={passo} />
      {id === null ? (
        <BuscaDoadorPasso
          onSelecionar={(d) => navegar(`/contribuicoes/nova/${d.id}`)}
        />
      ) : (
        <ComDoador
          key={id}
          doadorId={id}
          passo={passo}
          somenteDoacao={somenteDoacao}
          selecionadas={selecionadas}
          onSelecionar={setSelecionadas}
          onPasso={setPasso}
          onRegistrada={concluir}
        />
      )}
    </Pilha>
  )
}

function ComDoador({
  doadorId,
  passo,
  somenteDoacao,
  selecionadas,
  onSelecionar,
  onPasso,
  onRegistrada,
}: {
  doadorId: number
  passo: number
  somenteDoacao: boolean
  selecionadas: string[]
  onSelecionar(s: string[]): void
  onPasso(p: number): void
  onRegistrada(r: ContribuicaoRegistrada): void
}) {
  const navegar = useNavigate()
  const doador = useCarregamento(() => doadorService.obter(doadorId), [doadorId])
  const [completo, setCompleto] = useState(false)
  const painel = useCarregamento(
    () => competenciaService.painel(doadorId, completo),
    [doadorId, completo],
  )

  if (doador.carregando || (painel.carregando && !painel.dados)) return <Carregando />
  if (doador.erro || painel.erro || !doador.dados || !painel.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {doador.erro ?? painel.erro ?? 'Doador não encontrado.'}
      </Aviso>
    )
  }
  const d = doador.dados
  if (d.status === 'ANONIMIZADO') {
    return (
      <Aviso tipo="error" titulo="Doador anonimizado">
        Doador anonimizado não recebe contribuições.
      </Aviso>
    )
  }
  const p = painel.dados
  const escolhidas = somenteDoacao
    ? []
    : p.itens
        .filter((i) => i.selecionavel && selecionadas.includes(i.competencia))
        .map((i) => ({ mes: i.competencia, valor: i.valor }))

  return (
    <Pilha>
      <Pilha spacing={0.5} component="header">
        <Typography variant="h5" component="h2">
          {d.nome}
        </Typography>
        <TextoSuave>
          Mensalidade {formatarMoeda(p.mensalidadeAtual)} · {p.quantidadePendentes}{' '}
          {p.quantidadePendentes === 1 ? 'competência pendente' : 'competências pendentes'} (
          {formatarMoeda(p.totalPendente)})
        </TextoSuave>
        <LinhaAcoes>
          <LinkRota to={`/doadores/${d.id}`}>Ver histórico</LinkRota>
          {passo > 0 && (
            <LinkRota to="/contribuicoes/nova">Trocar doador</LinkRota>
          )}
        </LinhaAcoes>
      </Pilha>

      {passo === 1 && (
        <>
          <SelecaoCompetencias
            painel={p}
            selecionadas={selecionadas}
            onAlterar={onSelecionar}
          />
          {p.possuiMaisAntigas && !completo && (
            <div>
              <Button onClick={() => setCompleto(true)}>Mostrar mais</Button>
            </div>
          )}
          <LinhaAcoes>
            <Button onClick={() => navegar(`/doadores/${d.id}`)}>Cancelar</Button>
            <Button variant="contained" onClick={() => onPasso(2)}>
              Continuar
            </Button>
          </LinhaAcoes>
        </>
      )}
      {passo === 2 && (
        <EtapaPagamento
          doador={{ id: d.id, nome: d.nome }}
          competencias={escolhidas}
          onVoltar={somenteDoacao ? () => navegar(`/doadores/${d.id}`) : () => onPasso(1)}
          onRegistrada={onRegistrada}
        />
      )}
    </Pilha>
  )
}
