import { Button, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Fieldset, GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { hoje, paraIsoData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraCentavos, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { SeletorCategoria } from '../../financeiro/components/SeletorCategoria'
import { financeiroService } from '../../financeiro/services'
import type { Categoria } from '../../financeiro/types'
import { ROTULO_RECORRENCIA } from '../rotulos'
import { contasPagarService } from '../services'
import type { DetalheContaPagar, Recorrencia } from '../types'

const disponivel = (c: Categoria) => c.ativa && c.permiteManual

function camposDe(d: DetalheContaPagar | null) {
  const c = d?.conta
  return {
    descricao: c?.descricao ?? '',
    favorecido: c?.favorecido ?? '',
    categoria: c?.categoria ?? '',
    valor: c ? paraTextoDigitado(paraCentavos(c.valorPrevisto)) : '',
    recorrencia: (c?.recorrencia ?? 'MENSAL') as Recorrencia,
    primeiroVencimento: c?.primeiroVencimento ?? paraIsoData(hoje()),
    fimRecorrencia: c?.fimRecorrencia ?? '',
    conta: (c?.contaFinanceiraId ?? '') as number | '',
    observacoes: c?.observacoes ?? '',
  }
}

/** Cadastro e alteração de conta a pagar única ou recorrente (mensal ou anual). */
export function ContaPagarFormPage() {
  const { id } = useParams()
  const edicao = id !== undefined
  const detalhe = useCarregamento(() => (edicao ? contasPagarService.conta(Number(id)) : Promise.resolve(null)), [id])
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const categorias = useCarregamento(() => financeiroService.categorias(), [])
  if (detalhe.carregando || contas.carregando || categorias.carregando) return <Carregando />
  if (detalhe.erro) return <Aviso tipo="error" titulo="Erro">{detalhe.erro}</Aviso>
  return (
    <Formulario
      key={id ?? 'nova'}
      detalhe={detalhe.dados}
      categorias={categorias.dados ?? []}
      contas={(contas.dados ?? []).filter((c) => c.ativa && c.tipo !== 'CARTAO_A_RECEBER')}
    />
  )
}

function Formulario({
  detalhe,
  categorias,
  contas,
}: {
  detalhe: DetalheContaPagar | null
  categorias: Categoria[]
  contas: { id: number; nome: string }[]
}) {
  const navegar = useNavigate()
  const [campos, setCampos] = useState(() => camposDe(detalhe))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))
  const travada = (detalhe?.pagamentos.length ?? 0) > 0
  const titulo = detalhe ? `Alterar ${detalhe.conta.descricao}` : 'Nova conta a pagar'

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const centavos = lerValor(campos.valor)
    const locais: Record<string, string> = {}
    if (!campos.descricao.trim()) locais.descricao = 'Descreva a conta.'
    if (!campos.categoria) locais.categoria = 'Escolha a subcategoria.'
    if (centavos === null || Number.isNaN(centavos) || centavos <= 0) locais.valorPrevisto = 'Informe um valor maior que zero.'
    if (!campos.primeiroVencimento) locais.primeiroVencimento = 'Informe o vencimento.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setErro(null)
    setEnviando(true)
    const dados = {
      descricao: campos.descricao,
      favorecido: campos.favorecido || null,
      categoria: campos.categoria,
      valorPrevisto: paraReais(centavos!),
      recorrencia: campos.recorrencia,
      primeiroVencimento: campos.primeiroVencimento,
      fimRecorrencia: campos.recorrencia === 'UNICA' ? null : campos.fimRecorrencia || null,
      contaFinanceiraId: campos.conta || null,
      observacoes: campos.observacoes || null,
    }
    try {
      const c = detalhe ? await contasPagarService.alterar(detalhe.conta.id, dados) : await contasPagarService.cadastrar(dados)
      navegar(`/contas-pagar/${c.id}`)
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-form-conta-pagar">
      <LinkRota to={detalhe ? `/contas-pagar/${detalhe.conta.id}` : '/contas-pagar'}>Voltar</LinkRota>
      <TituloPagina id="titulo-form-conta-pagar">{titulo}</TituloPagina>
      <TextoSuave>
        Despesas fixas ou eventuais (ex.: aluguel, energia, internet, seguro). Cada vencimento é pago à parte, com o
        valor do dia, e gera a despesa no Financeiro.
      </TextoSuave>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      <Pilha component="form" onSubmit={(e) => void enviar(e)} noValidate spacing={2} aria-label={titulo}>
        <GradeForm>
          <TextField label="Descrição" required value={campos.descricao} onChange={(e) => alterar({ descricao: e.target.value })}
            error={!!erros.descricao} helperText={erros.descricao ?? 'Ex.: Conta de luz'} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField label="Favorecido (opcional)" value={campos.favorecido} onChange={(e) => alterar({ favorecido: e.target.value })}
            error={!!erros.favorecido} helperText={erros.favorecido ?? 'Quem recebe o pagamento'} autoComplete="off"
            slotProps={{ htmlInput: { maxLength: 200 }, inputLabel: { shrink: campos.favorecido !== '' || undefined } }} />
          <SeletorCategoria
            categorias={categorias}
            tipo="DESPESA"
            filtro={disponivel}
            valor={campos.categoria}
            onAlterar={(codigo) => alterar({ categoria: codigo })}
            erro={erros.categoria}
          />
          <CampoValor rotulo="Valor previsto" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })}
            ajuda={erros.valorPrevisto ?? 'Sugerido no pagamento; o valor pago pode ser diferente.'} />
        </GradeForm>
        <Fieldset>
          <FormLabel component="legend">Recorrência</FormLabel>
          <RadioGroup row value={campos.recorrencia} onChange={(e) => alterar({ recorrencia: e.target.value as Recorrencia })}>
            {(['UNICA', 'MENSAL', 'ANUAL'] as Recorrencia[]).map((r) => (
              <FormControlLabel key={r} value={r} control={<Radio />} label={ROTULO_RECORRENCIA[r]} disabled={travada} />
            ))}
          </RadioGroup>
          {travada && <TextoSuave>A recorrência e o primeiro vencimento não mudam depois do primeiro pagamento.</TextoSuave>}
        </Fieldset>
        <GradeForm>
          <TextField type="date" label={campos.recorrencia === 'UNICA' ? 'Vencimento' : 'Primeiro vencimento'} required
            value={campos.primeiroVencimento} onChange={(e) => alterar({ primeiroVencimento: e.target.value })} disabled={travada}
            error={!!erros.primeiroVencimento}
            helperText={erros.primeiroVencimento ?? (campos.recorrencia === 'UNICA' ? ' ' : 'Os próximos vencem no mesmo dia.')}
            slotProps={{ inputLabel: { shrink: true } }} />
          {campos.recorrencia !== 'UNICA' && (
            <TextField type="date" label="Último vencimento (opcional)" value={campos.fimRecorrencia}
              onChange={(e) => alterar({ fimRecorrencia: e.target.value })} error={!!erros.fimRecorrencia}
              helperText={erros.fimRecorrencia ?? 'Em branco: sem data para terminar.'} slotProps={{ inputLabel: { shrink: true } }} />
          )}
          <TextField select label="Pagar normalmente pela conta (opcional)" value={campos.conta}
            onChange={(e) => alterar({ conta: e.target.value === '' ? '' : Number(e.target.value) })}
            error={!!erros.contaFinanceiraId} helperText={erros.contaFinanceiraId ?? 'Sugerida no pagamento.'}>
            <MenuItem value="">Nenhuma</MenuItem>
            {contas.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
        </GradeForm>
        <TextField label="Observações (opcional)" multiline minRows={2} value={campos.observacoes}
          onChange={(e) => alterar({ observacoes: e.target.value })} error={!!erros.observacoes}
          helperText={erros.observacoes ?? ' '} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={enviando}>
            {detalhe ? 'Salvar alterações' : 'Cadastrar conta'}
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
