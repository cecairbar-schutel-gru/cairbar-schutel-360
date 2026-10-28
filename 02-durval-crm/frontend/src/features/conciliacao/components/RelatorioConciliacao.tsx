import { Box, Typography } from '@mui/material'
import {
  GradeForm,
  LinhaAcoes,
  Pilha,
  TextoSuave,
} from '../../../shared/components/layout'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import {
  formatarData,
  formatarDataHora,
} from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import {
  BotaoImprimir,
  EstiloImpressao,
} from '../../editoras/components/Impressao'
import { relatorioService } from '../../relatorios/services'
import { BotaoExportar } from '../../../shared/components/BotaoExportar'
import { somar } from '../regras'
import type { ItemConciliacao, SessaoConciliacao } from '../types'
import { TabelaLancamentos } from './TabelaLancamentos'

function Secao({
  titulo,
  itens,
  vazio,
  comMarcacao,
}: {
  titulo: string
  itens: ItemConciliacao[]
  vazio: string
  comMarcacao?: boolean
}) {
  return (
    <Box component="section" aria-label={titulo}>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h2">
          {titulo} ({itens.length})
        </Typography>
        {itens.length > 0 && (
          <Typography>Total: {formatarMoeda(somar(itens))}</Typography>
        )}
      </LinhaAcoes>
      {itens.length === 0 ? (
        <TextoSuave>{vazio}</TextoSuave>
      ) : (
        <TabelaLancamentos
          rotulo={titulo}
          itens={itens}
          comMarcacao={comMarcacao}
        />
      )}
    </Box>
  )
}

/**
 * Relatório da sessão concluída (US-RECONCILIATION-010), pronto para imprimir: saldo de partida,
 * conciliados, adicionados na conciliação, correções, pendentes e saldo do extrato.
 */
export function RelatorioConciliacao({
  sessao: s,
}: {
  sessao: SessaoConciliacao
}) {
  const adicionados = s.lancamentos.filter((l) => l.adicionado)
  const correcoes = s.lancamentos.filter(
    (l) => l.estornaLancamentoId !== null || l.corrigeLancamentoId !== null,
  )
  return (
    <Pilha component="article" aria-labelledby="titulo-relatorio-conciliacao">
      <EstiloImpressao />
      <LinhaAcoes data-nao-imprimir sx={{ justifyContent: 'space-between' }}>
        <LinkRota to={`/conciliacao/historico?contaId=${s.contaId}`}>
          Voltar ao histórico
        </LinkRota>
        <LinhaAcoes>
          <BotaoImprimir />
          <BotaoExportar
            exportar={(formato) =>
              relatorioService.exportar('conciliacao', formato, { id: s.id })
            }
          />
        </LinhaAcoes>
      </LinhaAcoes>
      <Box>
        <Typography variant="overline" color="text.secondary" component="p">
          Relatório de conciliação bancária nº {s.id}
        </Typography>
        <Typography
          id="titulo-relatorio-conciliacao"
          variant="h4"
          component="h1"
        >
          {s.contaNome} — conciliada até {formatarData(s.dataFim)}
        </Typography>
        <TextoSuave>
          {[
            s.banco,
            s.agencia && `Agência ${s.agencia}`,
            s.numeroConta && `Conta ${s.numeroConta}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </TextoSuave>
      </Box>
      <GradeForm aria-label="Saldos da conciliação">
        <Indicador
          rotulo="Saldo conciliado de partida"
          valor={formatarMoeda(s.saldoAbertura)}
        />
        <Indicador
          rotulo="Lançamentos conciliados"
          valor={formatarMoeda(s.totalMarcado)}
          detalhe={`${s.lancamentos.length} lançamento(s)`}
        />
        <Indicador
          rotulo={`Saldo do extrato em ${formatarData(s.dataFim)}`}
          valor={formatarMoeda(s.saldoExtrato)}
          destaque="primary"
        />
        <Indicador
          rotulo="Diferença"
          valor={formatarMoeda(s.diferenca)}
          destaque="success"
        />
      </GradeForm>
      <Secao
        titulo="Lançamentos conciliados"
        itens={s.lancamentos}
        vazio="Nenhum lançamento conciliado."
        comMarcacao
      />
      <Secao
        titulo="Adicionados durante a conciliação"
        itens={adicionados}
        vazio="Nenhum lançamento foi adicionado nesta sessão."
      />
      <Secao
        titulo="Correções (estornos e lançamentos corrigidos)"
        itens={correcoes}
        vazio="Nenhuma correção conciliada nesta sessão."
      />
      <Secao
        titulo="Pendentes (diferenças de prazo)"
        itens={s.pendentes}
        vazio="Nenhum lançamento ficou pendente até a data final."
      />
      {s.pendentes.length > 0 && (
        <TextoSuave>
          Pendentes estão no sistema, mas ainda não no extrato (ex.: um PIX
          recebido no último dia). Continuam não conciliados e aparecem na
          próxima sessão.
        </TextoSuave>
      )}
      <TextoSuave>
        {s.extrato &&
          `Extrato importado: ${s.extrato.arquivo} (${s.extrato.formato}), ${s.extrato.linhas.length} linha(s), ` +
            `${s.extrato.linhas.filter((l) => l.lancamentoId !== null).length} conferida(s) com lançamentos. `}
        Iniciada por {s.iniciadaPor} em {formatarDataHora(s.iniciadaEm)};
        concluída por {s.concluidaPor} em {formatarDataHora(s.concluidaEm)}.
      </TextoSuave>
    </Pilha>
  )
}
