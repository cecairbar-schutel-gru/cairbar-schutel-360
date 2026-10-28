import { MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { GradeForm, Pilha, TextoSuave } from '../../../shared/components/layout'
import { hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraCentavos, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { exigeNota, tipoDeConta } from '../regras'
import { ROTULO_MEIO } from '../rotulos'
import { intencaoService } from '../services'
import type { DetalheIntencao, MeioPagamentoGasto, OpcoesIntencao, ResultadoAcao } from '../types'

interface Props {
  intencao: DetalheIntencao
  opcoes: OpcoesIntencao
  onFechar(): void
  onAprovada(r: ResultadoAcao): void
}

/**
 * Aprovação (US-EXPENSE-004): confirma ou ajusta o valor total, a subcategoria, o meio, a conta de
 * origem e a data. Ajuste de valor ou categoria exige nota. Itens nunca são aprovados um a um.
 */
export function AprovarDialogo({ intencao: i, opcoes, onFechar, onAprovada }: Props) {
  const [campos, setCampos] = useState({
    valor: paraTextoDigitado(paraCentavos(i.valorSolicitado)),
    categoria: i.categoria,
    meio: 'PIX' as MeioPagamentoGasto,
    contaId: '' as number | '',
    data: paraIsoData(hoje()),
    nota: '',
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  const centavos = lerValor(campos.valor)
  const valor = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)
  const contas = opcoes.contas.filter((c) => c.tipo === tipoDeConta(campos.meio))
  const conta = contas.find((c) => c.id === campos.contaId)
  const subcategorias = opcoes.categorias.filter((c) => c.categoriaPai !== null && c.compraCantina === i.compraCantina)
  // Conta bancária pode ficar negativa, mas quem aprova é avisado antes (o caixa é bloqueado na validação).
  const saldoProjetado =
    conta?.tipo === 'BANCO' && centavos !== null && !Number.isNaN(centavos)
      ? paraReais(paraCentavos(conta.saldo) - centavos)
      : null
  const notaObrigatoria = exigeNota(i.valorSolicitado, valor, i.categoria, campos.categoria)

  async function aprovar() {
    const locais: Record<string, string> = {}
    if (valor === null || valor <= 0) locais.valor = 'Informe um valor maior que zero.'
    if (!conta) locais.contaId = 'Escolha a conta de origem.'
    else if (conta.tipo === 'CAIXA' && valor !== null && valor > conta.saldo) {
      locais.contaId = `O saldo de ${conta.nome} é ${formatarMoeda(conta.saldo)}: o caixa não pode ficar negativo.`
    }
    if (!campos.data) locais.data = 'Informe a data do pagamento.'
    if (notaObrigatoria && !campos.nota.trim()) locais.nota = 'Explique o ajuste de valor ou de categoria.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setEnviando(true)
    setErro(null)
    try {
      onAprovada(
        await intencaoService.aprovar(i.id, {
          valor: valor!,
          categoria: campos.categoria,
          meio: campos.meio,
          contaId: Number(campos.contaId),
          data: campos.data,
          nota: campos.nota,
        }),
      )
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={`Intenção nº ${i.id} · ${i.descricao}`}
      titulo="Aprovar gasto"
      textoConfirmar="Aprovar e registrar despesa"
      confirmarDesabilitado={enviando}
      onFechar={onFechar}
      onConfirmar={() => void aprovar()}
    >
      <Pilha spacing={2}>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível aprovar">
            {erro}
          </Aviso>
        )}
        <TextoSuave>
          Pedido: {formatarMoeda(i.valorSolicitado)} em {i.categoriaNome}.
          {i.compraCantina && ' Só o valor total pode mudar; os itens não são aprovados um a um.'}
        </TextoSuave>
        <GradeForm>
          <CampoValor rotulo="Valor aprovado" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })} ajuda={erros.valor ?? ' '} />
          <TextField
            select
            label="Subcategoria"
            value={campos.categoria}
            onChange={(e) => alterar({ categoria: e.target.value })}
            error={!!erros.categoria}
            helperText={erros.categoria ?? ' '}
          >
            {subcategorias.map((c) => (
              <MenuItem key={c.codigo} value={c.codigo}>
                {c.nomeCompleto}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Meio de pagamento"
            value={campos.meio}
            onChange={(e) => alterar({ meio: e.target.value as MeioPagamentoGasto, contaId: '' })}
            helperText={erros.meio ?? 'Cartão não é meio de pagamento de despesas.'}
          >
            {(Object.keys(ROTULO_MEIO) as MeioPagamentoGasto[]).map((m) => (
              <MenuItem key={m} value={m}>
                {ROTULO_MEIO[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={campos.meio === 'DINHEIRO' ? 'Caixa de origem' : 'Conta bancária de origem'}
            value={campos.contaId}
            onChange={(e) => alterar({ contaId: Number(e.target.value) })}
            error={!!erros.contaId}
            helperText={erros.contaId ?? (conta ? `Saldo atual: ${formatarMoeda(conta.saldo)}` : ' ')}
          >
            {contas.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Data do pagamento"
            value={campos.data}
            onChange={(e) => alterar({ data: e.target.value })}
            error={!!erros.data}
            helperText={erros.data ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }}
          />
        </GradeForm>
        <TextField
          label={notaObrigatoria ? 'Nota do ajuste' : 'Nota (opcional)'}
          required={notaObrigatoria}
          multiline
          minRows={2}
          value={campos.nota}
          onChange={(e) => alterar({ nota: e.target.value })}
          error={!!erros.nota}
          helperText={erros.nota ?? (notaObrigatoria ? 'O solicitante verá o valor pedido, o aprovado e esta nota.' : ' ')}
        />
        {conta && saldoProjetado !== null && saldoProjetado < 0 && (
          <Aviso tipo="warning" titulo="O saldo vai ficar negativo">
            Depois deste pagamento, o saldo de {conta.nome} ficará em {formatarMoeda(saldoProjetado)} (hoje:{' '}
            {formatarMoeda(conta.saldo)}). A aprovação é permitida; confira se a conta é a certa.
          </Aviso>
        )}
      </Pilha>
    </DialogoAcao>
  )
}
