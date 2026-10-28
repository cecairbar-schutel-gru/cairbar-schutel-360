import {
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { useRef, useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Fieldset, Pilha, TextoSuave } from '../../../shared/components/layout'
import {
  formatarData,
  hoje,
  paraIsoData,
} from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import {
  lerValor,
  novaChaveIdempotencia,
  paraCentavos,
  paraReais,
  paraTextoDigitado,
} from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { SeletorCategoria } from '../../financeiro/components/SeletorCategoria'
import { financeiroService } from '../../financeiro/services'
import type { Categoria, ResultadoLancamento } from '../../financeiro/types'
import { CATEGORIA_SUGERIDA } from '../regras'
import { conciliacaoService } from '../services'
import type {
  LinhaDoExtrato,
  SessaoConciliacao,
  TipoLancamentoAusente,
} from '../types'

interface Props {
  sessao: SessaoConciliacao
  /** Linha do extrato importado sem lançamento: preenche o formulário e fica ligada ao novo lançamento. */
  linha?: LinhaDoExtrato
  onFechar(): void
  onConcluido(resultado: ResultadoLancamento): void
}

const ROTULO_TIPO: Record<TipoLancamentoAusente, string> = {
  DESPESA: 'Despesa (ex.: tarifa bancária)',
  RECEITA: 'Receita (ex.: rendimento, outras entradas)',
  TRANSFERENCIA: 'Transferência entre contas próprias',
}

const permiteManual = (c: Categoria) => c.ativa && c.permiteManual

/**
 * Lançamento ausente (US-RECONCILIATION-005): movimento do extrato que o sistema não tem. Receita ou
 * despesa vira lançamento manual na conta conciliada; dinheiro do caixa depositado é transferência,
 * não receita. Entra já marcado na sessão.
 */
export function AdicionarLancamentoDialogo({
  sessao,
  linha,
  onFechar,
  onConcluido,
}: Props) {
  const ultimoDia =
    sessao.dataFim < paraIsoData(hoje()) ? sessao.dataFim : paraIsoData(hoje())
  const tipoInicial: TipoLancamentoAusente =
    linha && linha.valor > 0 ? 'RECEITA' : 'DESPESA'
  const [tipo, setTipo] = useState<TipoLancamentoAusente>(tipoInicial)
  const [categoria, setCategoria] = useState(
    CATEGORIA_SUGERIDA[tipoInicial].codigo,
  )
  const [entrada, setEntrada] = useState(linha ? linha.valor > 0 : true)
  const [contraparte, setContraparte] = useState<number | ''>('')
  const [data, setData] = useState(linha?.data ?? ultimoDia)
  const [valor, setValor] = useState(
    linha ? paraTextoDigitado(Math.abs(paraCentavos(linha.valor))) : '',
  )
  const [descricao, setDescricao] = useState(
    linha?.descricao.slice(0, 200) ?? '',
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const chave = useRef(novaChaveIdempotencia())
  const categorias = useCarregamento(() => financeiroService.categorias(), [])
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const outrasContas = (contas.dados ?? []).filter(
    (c) => c.ativa && c.tipo !== 'CARTAO_A_RECEBER' && c.id !== sessao.contaId,
  )
  const transferencia = tipo === 'TRANSFERENCIA'

  function trocarTipo(novo: TipoLancamentoAusente) {
    setTipo(novo)
    if (novo !== 'TRANSFERENCIA') setCategoria(CATEGORIA_SUGERIDA[novo].codigo)
    setErros({})
  }

  async function confirmar() {
    const centavos = lerValor(valor)
    const locais: Record<string, string> = {}
    if (!data) locais.data = 'Informe a data.'
    else if (data > sessao.dataFim)
      locais.data = `Use uma data até o fim do extrato (${formatarData(sessao.dataFim)}).`
    if (centavos === null || Number.isNaN(centavos) || centavos <= 0)
      locais.valor = 'Informe um valor maior que zero.'
    if (transferencia && contraparte === '')
      locais.contraparteId = 'Escolha a outra conta da transferência.'
    if (!transferencia && !categoria)
      locais.categoria = 'Escolha a subcategoria.'
    if (!transferencia && !descricao.trim())
      locais.descricao = 'Descreva o lançamento (como aparece no extrato).'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    setErro(null)
    try {
      onConcluido(
        await conciliacaoService.adicionarLancamento(sessao.id, {
          tipo,
          data,
          valor: paraReais(centavos!),
          descricao,
          ...(transferencia
            ? { contraparteId: Number(contraparte), entrada }
            : { categoria }),
          ...(linha ? { linhaExtratoId: linha.id } : {}),
          chaveIdempotencia: chave.current,
        }),
      )
    } catch (e) {
      setErros(errosPorCampo(e))
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={`${sessao.contaNome} · extrato até ${formatarData(sessao.dataFim)}`}
      titulo="Adicionar lançamento ausente"
      textoConfirmar="Registrar e marcar"
      confirmarDesabilitado={enviando}
      onFechar={onFechar}
      onConfirmar={() => void confirmar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          Para um movimento que está no extrato e não no sistema. Ele entra já
          marcado nesta conciliação, sinalizado como “Adicionado na
          conciliação”.
        </TextoSuave>
        {linha && (
          <Aviso tipo="info" titulo="Linha do extrato">
            {formatarData(linha.data)} · {linha.descricao} ·{' '}
            {formatarMoeda(linha.valor)}. O lançamento fica ligado a ela.
          </Aviso>
        )}
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível registrar">
            {erro}
          </Aviso>
        )}
        <Fieldset>
          <FormLabel component="legend">Tipo</FormLabel>
          <RadioGroup
            value={tipo}
            onChange={(e) =>
              trocarTipo(e.target.value as TipoLancamentoAusente)
            }
          >
            {(Object.keys(ROTULO_TIPO) as TipoLancamentoAusente[]).map((t) => (
              <FormControlLabel
                key={t}
                value={t}
                control={<Radio />}
                label={ROTULO_TIPO[t]}
              />
            ))}
          </RadioGroup>
        </Fieldset>
        {transferencia && (
          <Aviso tipo="info" titulo="Transferência não é receita">
            Dinheiro do caixa depositado no banco (ou um saque) é
            transferência entre contas próprias: não entra como receita nem
            despesa.
          </Aviso>
        )}
        {/* Valor e descrição logo depois do tipo: a descrição obrigatória não fica abaixo da dobra. */}
        <CampoValor
          rotulo="Valor"
          valor={valor}
          onAlterar={setValor}
          ajuda={erros.valor ?? ' '}
        />
        <TextField
          label={transferencia ? 'Descrição (opcional)' : 'Descrição'}
          required={!transferencia}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          error={!!erros.descricao}
          helperText={erros.descricao ?? ' '}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        {transferencia ? (
          <>
            <Fieldset>
              <FormLabel component="legend">No extrato, o dinheiro</FormLabel>
              <RadioGroup
                row
                value={entrada ? 'entrada' : 'saida'}
                onChange={(e) => setEntrada(e.target.value === 'entrada')}
              >
                <FormControlLabel
                  value="entrada"
                  control={<Radio />}
                  label={`Entrou em ${sessao.contaNome}`}
                />
                <FormControlLabel
                  value="saida"
                  control={<Radio />}
                  label={`Saiu de ${sessao.contaNome}`}
                />
              </RadioGroup>
            </Fieldset>
            <TextField
              select
              label={entrada ? 'Veio de' : 'Foi para'}
              required
              value={contraparte}
              onChange={(e) => setContraparte(Number(e.target.value))}
              error={!!erros.contraparteId}
              helperText={erros.contraparteId ?? ' '}
            >
              {outrasContas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nome}
                </MenuItem>
              ))}
            </TextField>
          </>
        ) : (
          categorias.dados && (
            <>
              <SeletorCategoria
                key={tipo}
                categorias={categorias.dados}
                tipo={tipo}
                filtro={permiteManual}
                valor={categoria}
                onAlterar={setCategoria}
                erro={erros.categoria}
              />
              <TextoSuave>
                Sugestão: {CATEGORIA_SUGERIDA[tipo].nome}.
              </TextoSuave>
            </>
          )
        )}
        <TextField
          type="date"
          label="Data"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          error={!!erros.data}
          helperText={
            erros.data ??
            `Até o fim do extrato (${formatarData(sessao.dataFim)}).`
          }
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: ultimoDia },
          }}
        />
      </Pilha>
    </DialogoAcao>
  )
}
