import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { editoraService } from '../../editoras/services'
import { CabecalhoRelatorio } from '../components/CabecalhoRelatorio'
import { Colunas } from '../components/Colunas'
import { FiltroPeriodo } from '../components/FiltroPeriodo'
import { TabelaCategorias } from '../components/TabelaCategorias'
import { descreverPeriodo, linkLancamentos } from '../regras'
import { relatorioService } from '../services'
import { useFiltrosNaUrl } from '../useFiltrosNaUrl'

/**
 * Receitas e despesas por categoria (US-REPORT-002), no layout do wireframe 12: indicadores, as
 * duas tabelas com barra de participação e o resultado. Mostra todo o plano de contas ativo e as
 * categorias inativas que tiveram lançamentos, pela classificação atual de cada lançamento. Ao lado
 * do resultado, o saldo devido hoje às editoras: em regime de caixa ele só sai do resultado quando
 * for pago, e sem o destaque o resultado parece uma sobra maior do que é.
 */
export function ReceitasDespesasPage() {
  const { periodo, definirPeriodo } = useFiltrosNaUrl()
  const { dados, carregando, erro } = useCarregamento(() => relatorioService.receitasDespesas(periodo), [periodo.de, periodo.ate])
  const editoras = useCarregamento(() => editoraService.saldos(), [])
  return (
    <Pilha component="section" aria-labelledby="titulo-receitas-despesas">
      <CabecalhoRelatorio
        id="titulo-receitas-despesas"
        titulo={`Receitas e despesas — ${descreverPeriodo(periodo)}`}
        exportar={(formato) => relatorioService.exportar('receitas-despesas', formato, { ...periodo })}
        filtros={<FiltroPeriodo key={`${periodo.de}:${periodo.ate}`} periodo={periodo} onChange={definirPeriodo} />}
      />
      {carregando && <Carregando linhas={6} />}
      {erro && (
        <Aviso tipo="error" titulo="Erro">
          {erro}
        </Aviso>
      )}
      {dados && !carregando && (
        <>
          <GradeForm aria-label="Resumo do período">
            <Indicador rotulo="Receitas" valor={formatarMoeda(dados.totalReceitas)} destaque="success" />
            <Indicador rotulo="Despesas" valor={formatarMoeda(dados.totalDespesas)} destaque="error" />
            <Indicador rotulo="Resultado (receitas − despesas)" valor={formatarMoeda(dados.resultado)}
              destaque={dados.resultado < 0 ? 'error' : 'primary'} />
            {editoras.dados && (
              <Indicador rotulo="Devido às editoras (saldo atual)" valor={formatarMoeda(editoras.dados.total)}
                destaque={editoras.dados.total > 0 ? 'warning' : undefined} detalhe="Ainda não descontado do resultado" />
            )}
          </GradeForm>
          <Colunas>
            <TabelaCategorias titulo="Receitas por categoria" grupos={dados.receitas} total={dados.totalReceitas} periodo={periodo} />
            <TabelaCategorias titulo="Despesas por categoria" grupos={dados.despesas} total={dados.totalDespesas} periodo={periodo} />
          </Colunas>
          <TextoSuave>
            Relatório com valores agregados, em regime de caixa e pela classificação atual de cada lançamento; estornos
            descontados na data em que foram lançados e transferências entre contas próprias fora do resultado. As
            transações individuais estão em <LinkRota to={linkLancamentos(periodo)}>Lançamentos</LinkRota>. O valor
            devido às editoras é o saldo de hoje, não o do período: as vendas de livros consignados entram como receita, e
            o repasse só vira despesa quando é pago, em <LinkRota to="/editoras/saldos">Acertos com editoras</LinkRota>.
          </TextoSuave>
        </>
      )}
    </Pilha>
  )
}
