import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { MINIMO_MOTIVO_ESTORNO } from '../regras'
import { financeiroService } from '../services'
import type { Categoria, Correcao, DetalheLancamento, ResultadoEstorno, TipoCategoria } from '../types'
import { SeletorCategoria } from './SeletorCategoria'

interface Props {
  lancamento: DetalheLancamento
  onFechar(): void
  onConcluido(resultado: ResultadoEstorno): void
}

const texto = (valor: number) => paraTextoDigitado(Math.round(Math.abs(valor) * 100))
const ler = (t: string) => {
  const c = lerValor(t)
  return c === null || Number.isNaN(c) ? null : paraReais(c)
}

/** Valores do lançamento original, para o Tesoureiro corrigir só o que estava errado. */
function correcaoInicial(l: DetalheLancamento) {
  const positiva = l.linhasConta.find((c) => c.valor > 0)
  const negativa = l.linhasConta.find((c) => c.valor < 0)
  const banco = l.linhasConta.find((c) => c.tipoConta === 'BANCO')
  const taxa = l.linhasCategoria[0]?.valor ?? 0
  return {
    data: l.data,
    contaId: (l.origemTipo === 'TRANSFERENCIA' ? negativa?.contaId : l.origemTipo === 'LIQUIDACAO_CARTAO' ? banco?.contaId : l.linhasConta[0]?.contaId) ?? ('' as number | ''),
    contaDestinoId: (positiva?.contaId ?? '') as number | '',
    tipo: (l.natureza === 'RECEITA' ? 'RECEITA' : 'DESPESA') as TipoCategoria,
    categoria: l.linhasCategoria[0]?.codigo ?? '',
    valor: texto(l.valor),
    taxa: texto(taxa),
    descricao: l.descricao,
    referencia: l.referenciaExterna ?? '',
  }
}

/**
 * Estorno (US-FINANCIAL-010): cria o lançamento inverso, com motivo, e opcionalmente o lançamento
 * correto ligado ao original. O original nunca é editado.
 */
export function EstornoModal({ lancamento: l, onFechar, onConcluido }: Props) {
  const [motivo, setMotivo] = useState('')
  const [corrigir, setCorrigir] = useState(false)
  const [c, setC] = useState(() => correcaoInicial(l))
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const categorias = useCarregamento(
    () => (l.origemTipo === 'MANUAL' ? financeiroService.categorias() : Promise.resolve([] as Categoria[])),
    [l.origemTipo],
  )
  const alterar = (parcial: Partial<typeof c>) => setC((atual) => ({ ...atual, ...parcial }))
  const ativas = (contas.dados ?? []).filter((x) => x.ativa && x.tipo !== 'CARTAO_A_RECEBER')
  const bancos = ativas.filter((x) => x.tipo === 'BANCO')
  const motivoValido = motivo.trim().length >= MINIMO_MOTIVO_ESTORNO

  function correcao(): Correcao | null {
    const valor = ler(c.valor)
    if (valor === null) return null
    const base = { data: c.data, contaId: c.contaId === '' ? null : c.contaId, valor }
    if (l.origemTipo === 'TRANSFERENCIA') return { ...base, contaDestinoId: c.contaDestinoId === '' ? null : c.contaDestinoId, descricao: c.descricao }
    if (l.origemTipo === 'LIQUIDACAO_CARTAO') return { ...base, taxa: ler(c.taxa) ?? 0, referencia: c.referencia }
    return { ...base, tipo: c.tipo, categoria: c.categoria, descricao: c.descricao }
  }

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      if (corrigir && correcao() === null) throw new Error('Informe o valor correto.')
      onConcluido(await financeiroService.estornar(l.id, motivo.trim(), corrigir ? correcao() : null))
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  const contaSelect = (rotulo: string, valor: number | '', lista: typeof ativas, onAlterar: (id: number) => void) => (
    <TextField select label={rotulo} required value={valor} onChange={(e) => onAlterar(Number(e.target.value))}>
      {lista.map((x) => (
        <MenuItem key={x.id} value={x.id}>
          {x.nome}
        </MenuItem>
      ))}
    </TextField>
  )
  return (
    <DialogoAcao
      aberto
      perigo
      rotulo={`Lançamento nº ${l.id}`}
      titulo="Estornar lançamento"
      textoConfirmar={corrigir ? 'Estornar e registrar a correção' : 'Estornar'}
      confirmarDesabilitado={!motivoValido || enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          Será criado um lançamento que anula exatamente este ({formatarMoeda(l.valor)} em {formatarData(l.data)}). Se o mês
          estiver fechado, o estorno vai para hoje, no período aberto.
        </TextoSuave>
        {l.conciliado && (
          <Aviso tipo="warning" titulo="Lançamento conciliado">
            Desmarque-o na conciliação ou concilie também o estorno na próxima sessão.
          </Aviso>
        )}
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível estornar">
            {erro}
          </Aviso>
        )}
        <TextField
          label="Motivo"
          required
          multiline
          minRows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          helperText={`Pelo menos ${MINIMO_MOTIVO_ESTORNO} caracteres (${motivo.trim().length} digitados).`}
        />
        <FormControlLabel
          control={<Checkbox checked={corrigir} onChange={(e) => setCorrigir(e.target.checked)} />}
          label="Registrar também o lançamento correto"
        />
        {corrigir && (
          <GradeForm>
            <TextField type="date" label="Data" required value={c.data} onChange={(e) => alterar({ data: e.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
            {l.origemTipo === 'TRANSFERENCIA' && (
              <>
                {contaSelect('De (origem)', c.contaId, ativas, (id) => alterar({ contaId: id }))}
                {contaSelect('Para (destino)', c.contaDestinoId, ativas, (id) => alterar({ contaDestinoId: id }))}
                <CampoValor rotulo="Valor correto" valor={c.valor} onAlterar={(v) => alterar({ valor: v })} />
              </>
            )}
            {l.origemTipo === 'LIQUIDACAO_CARTAO' && (
              <>
                {contaSelect('Conta bancária', c.contaId, bancos, (id) => alterar({ contaId: id }))}
                <CampoValor rotulo="Bruto correto" valor={c.valor} onAlterar={(v) => alterar({ valor: v })} />
                <CampoValor rotulo="Taxa correta" valor={c.taxa} onAlterar={(v) => alterar({ taxa: v })} />
                <TextField label="Referência" value={c.referencia} onChange={(e) => alterar({ referencia: e.target.value })} />
              </>
            )}
            {l.origemTipo === 'MANUAL' && (
              <>
                {contaSelect('Conta', c.contaId, ativas, (id) => alterar({ contaId: id }))}
                {categorias.dados && (
                  <SeletorCategoria
                    categorias={categorias.dados}
                    tipo={c.tipo}
                    filtro={(x) => x.ativa && x.permiteManual}
                    valor={c.categoria}
                    onAlterar={(codigo) => alterar({ categoria: codigo })}
                  />
                )}
                <CampoValor rotulo="Valor correto" valor={c.valor} onAlterar={(v) => alterar({ valor: v })} />
              </>
            )}
            {l.origemTipo !== 'LIQUIDACAO_CARTAO' && (
              <TextField label="Descrição" value={c.descricao} onChange={(e) => alterar({ descricao: e.target.value })} />
            )}
          </GradeForm>
        )}
      </Pilha>
    </DialogoAcao>
  )
}
