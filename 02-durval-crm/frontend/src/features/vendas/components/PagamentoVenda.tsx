import { Button, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { LinhaAcoes, Pilha } from '../../../shared/components/layout'
import { CampoValor, CamposPagamento } from '../../../shared/pagamento/CamposPagamento'
import {
  brlCentavos,
  lerValor,
  paraTextoDigitado,
  ERRO_TIPO_CARTAO,
  ROTULO_MEIO,
  type ContasDeRecebimento,
  type MeioPagamento,
  type ResumoPagamento,
  type ValoresDigitados,
} from '../../../shared/pagamento/regras'
import { calcularTroco } from '../regras'

interface Props {
  total: number
  valores: ValoresDigitados
  onAlterar(alterar: (v: ValoresDigitados) => ValoresDigitados): void
  entregue: string
  onAlterarEntregue(valor: string): void
  contas: ContasDeRecebimento
  resumo: ResumoPagamento
}

/**
 * Pagamento da venda (US-SALES-005): dinheiro, PIX e cartão, atalho "Tudo em…", troco calculado
 * sobre o valor entregue (só o valor da venda é registrado) e a diferença que bloqueia a confirmação.
 */
export function PagamentoVenda({ total, valores, onAlterar, entregue, onAlterarEntregue, contas, resumo }: Props) {
  const dinheiro = resumo.pagamentos.filter((p) => p.meio === 'DINHEIRO').reduce((s, p) => s + Math.round(p.valor * 100), 0)
  const valorEntregue = lerValor(entregue)
  const troco = calcularTroco(valorEntregue, dinheiro)
  // Crédito ou débito já aparece no seletor do cartão; os avisos ficam para os valores.
  const errosDeValor = resumo.erros.filter((m) => m !== ERRO_TIPO_CARTAO)

  function tudoEm(meio: MeioPagamento) {
    const texto = paraTextoDigitado(total)
    onAlterar((v) => ({
      dinheiro: meio === 'DINHEIRO' ? texto : '',
      pix: meio === 'PIX' ? texto : '',
      cartao: meio === 'CARTAO' ? texto : '',
      tipoCartao: meio === 'CARTAO' ? v.tipoCartao : '',
    }))
    if (meio !== 'DINHEIRO') onAlterarEntregue('')
  }

  return (
    <Pilha spacing={2}>
      <LinhaAcoes>
        {(['DINHEIRO', 'PIX', 'CARTAO'] as MeioPagamento[]).map((meio) => (
          <Button
            key={meio}
            variant="outlined"
            disabled={total === 0 || (meio === 'DINHEIRO' && !contas.dinheiro) || (meio === 'PIX' && !contas.pix)}
            onClick={() => tudoEm(meio)}
          >
            Tudo em {ROTULO_MEIO[meio]}
          </Button>
        ))}
      </LinhaAcoes>
      <CamposPagamento
        valores={valores}
        onAlterar={onAlterar}
        contas={contas}
        rotuloDinheiro="Dinheiro (valor da venda)"
        extras={
          <CampoValor
            rotulo="Valor entregue pelo cliente (opcional)"
            valor={entregue}
            onAlterar={onAlterarEntregue}
            ajuda={
              valorEntregue !== null && Number.isNaN(valorEntregue)
                ? 'Valor inválido.'
                : troco !== null && troco < 0
                  ? 'O valor entregue é menor que a parte em dinheiro.'
                  : 'Para calcular o troco do dinheiro.'
            }
          />
        }
      />
      <TableContainer>
        <Table size="small" aria-label="Resumo do pagamento">
          <TableBody>
            <TableRow>
              <TableCell>Total da venda</TableCell>
              <TableCell align="right">{brlCentavos(total)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total informado</TableCell>
              <TableCell align="right">{brlCentavos(resumo.recebido)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Diferença</TableCell>
              <TableCell align="right">{brlCentavos(resumo.diferenca)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      {troco !== null && troco >= 0 && (
        <Typography variant="h6" component="p" aria-live="polite">
          Troco: {brlCentavos(troco)}
        </Typography>
      )}
      <div aria-live="polite">
        {errosDeValor.map((m) => (
          <Aviso key={m} tipo="error" titulo="Valor inválido">
            {m}
          </Aviso>
        ))}
        {errosDeValor.length === 0 && total > 0 && resumo.recebido > 0 && resumo.diferenca < 0 && (
          <Aviso tipo="error" titulo="Pagamento incompleto">
            Faltam {brlCentavos(-resumo.diferenca)} para fechar o total de {brlCentavos(total)}.
          </Aviso>
        )}
        {errosDeValor.length === 0 && total > 0 && resumo.diferenca > 0 && (
          <Aviso tipo="error" titulo="Pagamento acima do total">
            Os pagamentos passam o total em {brlCentavos(resumo.diferenca)}. Registre só o valor da venda; o
            troco não entra.
          </Aviso>
        )}
      </div>
    </Pilha>
  )
}
