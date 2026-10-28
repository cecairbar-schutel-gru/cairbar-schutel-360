import { FormControl, FormControlLabel, FormHelperText, FormLabel, InputAdornment, Radio, RadioGroup, TextField } from '@mui/material'
import type { ReactNode } from 'react'
import { Fieldset, GradeForm, Legenda } from '../components/layout'
import {
  ERRO_TIPO_CARTAO,
  filtrarValorDigitado,
  lerValor,
  ROTULO_TIPO_CARTAO,
  type ContasDeRecebimento,
  type TipoCartao,
  type ValoresDigitados,
} from './regras'

/** Campo em reais: aceita só dígitos e um separador decimal com até duas casas. */
export function CampoValor({
  rotulo,
  valor,
  onAlterar,
  ajuda,
  desabilitado,
}: {
  rotulo: string
  valor: string
  onAlterar(valor: string): void
  ajuda?: ReactNode
  desabilitado?: boolean
}) {
  return (
    <TextField
      label={rotulo}
      value={valor}
      onChange={(e) => onAlterar(filtrarValorDigitado(e.target.value))}
      helperText={ajuda}
      disabled={desabilitado}
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        },
        htmlInput: { inputMode: 'decimal' },
      }}
    />
  )
}

interface Props {
  valores: ValoresDigitados
  onAlterar(alterar: (v: ValoresDigitados) => ValoresDigitados): void
  /** Conta de recebimento de cada forma, definida pelo Administrador. */
  contas: ContasDeRecebimento
  rotuloDinheiro: string
  /** Campos extras ao lado das formas (ex.: valor entregue e troco na venda). */
  extras?: ReactNode
}

const SEM_CONTA = 'Sem conta de recebimento: peça ao Administrador.'

/** Crédito ou débito, obrigatório quando há valor em cartão. */
export function SeletorTipoCartao({ valor, onAlterar }: { valor: TipoCartao | ''; onAlterar(tipo: TipoCartao): void }) {
  return (
    <FormControl required error={!valor}>
      <FormLabel id="rotulo-tipo-cartao">Tipo do cartão</FormLabel>
      <RadioGroup row aria-labelledby="rotulo-tipo-cartao" value={valor} onChange={(e) => onAlterar(e.target.value as TipoCartao)}>
        {(Object.keys(ROTULO_TIPO_CARTAO) as TipoCartao[]).map((t) => (
          <FormControlLabel key={t} value={t} control={<Radio />} label={ROTULO_TIPO_CARTAO[t]} />
        ))}
      </RadioGroup>
      <FormHelperText>{valor ? ' ' : ERRO_TIPO_CARTAO}</FormHelperText>
    </FormControl>
  )
}

/**
 * Divisão do valor entre dinheiro, PIX e cartão (US-CONTRIB-004 e US-SALES-005). Cada forma entra na
 * conta de recebimento definida pelo Administrador; uma forma sem conta fica desabilitada.
 */
export function CamposPagamento({ valores, onAlterar, contas, rotuloDinheiro, extras }: Props) {
  return (
    <Fieldset>
      <Legenda>Formas de pagamento</Legenda>
      <GradeForm>
        <CampoValor
          rotulo={rotuloDinheiro}
          valor={valores.dinheiro}
          onAlterar={(dinheiro) => onAlterar((v) => ({ ...v, dinheiro }))}
          ajuda={contas.dinheiro ? `Entra em ${contas.dinheiro.nome}.` : SEM_CONTA}
          desabilitado={!contas.dinheiro}
        />
        <CampoValor
          rotulo="PIX"
          valor={valores.pix}
          onAlterar={(pix) => onAlterar((v) => ({ ...v, pix }))}
          ajuda={contas.pix ? `Entra em ${contas.pix.nome}.` : SEM_CONTA}
          desabilitado={!contas.pix}
        />
        <CampoValor
          rotulo="Cartão"
          valor={valores.cartao}
          onAlterar={(cartao) => onAlterar((v) => ({ ...v, cartao }))}
          ajuda={`Entra em ${contas.cartaoAReceber.nome}.`}
        />
        {(lerValor(valores.cartao) ?? 0) > 0 && (
          <SeletorTipoCartao valor={valores.tipoCartao} onAlterar={(tipoCartao) => onAlterar((v) => ({ ...v, tipoCartao }))} />
        )}
        {extras}
      </GradeForm>
    </Fieldset>
  )
}
