import { Button, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, TextField } from '@mui/material'
import { useRef, useState, type FormEvent } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { LinkRota } from '../../../shared/components/LinkRota'
import { Fieldset, GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, hoje, paraIsoData } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, novaChaveIdempotencia, paraReais } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { ResultadoOperacao } from '../components/ResultadoOperacao'
import { SeletorCategoria } from '../components/SeletorCategoria'
import { erroAnexo, lerAnexo } from '../regras'
import { ROTULO_TIPO_CATEGORIA } from '../rotulos'
import { financeiroService } from '../services'
import type { Categoria, ResultadoLancamento, TipoCategoria } from '../types'

const permiteManual = (c: Categoria) => c.ativa && c.permiteManual

/**
 * Lançamento manual de receita ou despesa (US-FINANCIAL-009), com confirmação. Categorias com
 * fluxo próprio (mensalidades, doações, vendas, repasses, taxas de cartão, compras da cantina) não
 * aparecem.
 */
export function LancamentoManualPage() {
  const contas = useCarregamento(() => financeiroService.contas(), [])
  const categorias = useCarregamento(() => financeiroService.categorias(), [])
  const [campos, setCampos] = useState({
    conta: '' as number | '',
    data: paraIsoData(hoje()),
    tipo: 'DESPESA' as TipoCategoria,
    categoria: '',
    valor: '',
    descricao: '',
  })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoLancamento | null>(null)
  const [versao, setVersao] = useState(0)
  const chave = useRef(novaChaveIdempotencia())
  const alterar = (parcial: Partial<typeof campos>) => setCampos((c) => ({ ...c, ...parcial }))

  if (contas.carregando || categorias.carregando) return <Carregando />
  const disponiveis = (contas.dados ?? []).filter((c) => c.ativa && c.tipo !== 'CARTAO_A_RECEBER')
  const conta = disponiveis.find((c) => c.id === campos.conta)
  const centavos = lerValor(campos.valor)
  const valor = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)
  const nomeCategoria = categorias.dados?.find((c) => c.codigo === campos.categoria)?.nomeCompleto

  function validar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!conta) locais.contaId = 'Escolha a conta.'
    if (!campos.data) locais.data = 'Informe a data.'
    if (!nomeCategoria) locais.categoria = 'Escolha a subcategoria.'
    if (valor === null || valor <= 0) locais.valor = 'Informe um valor maior que zero.'
    else if (campos.tipo === 'DESPESA' && conta?.tipo === 'CAIXA' && valor > (conta.saldo ?? 0)) {
      locais.valor = `O saldo de ${conta.nome} é ${formatarMoeda(conta.saldo ?? 0)}: o caixa não pode ficar negativo.`
    }
    if (!campos.descricao.trim()) locais.descricao = 'Descreva o lançamento.'
    if (arquivo && erroAnexo(arquivo)) locais.anexo = erroAnexo(arquivo)!
    setErros(locais)
    if (Object.keys(locais).length === 0) setConfirmando(true)
  }

  async function enviar() {
    setErro(null)
    try {
      const r = await financeiroService.lancarManual({
        contaId: Number(campos.conta),
        data: campos.data,
        tipo: campos.tipo,
        categoria: campos.categoria,
        valor: valor!,
        descricao: campos.descricao,
        anexo: arquivo ? await lerAnexo(arquivo) : null,
        chaveIdempotencia: chave.current,
      })
      setResultado(r)
      setCampos((c) => ({ ...c, categoria: '', valor: '', descricao: '' }))
      setArquivo(null)
      setVersao((v) => v + 1)
      chave.current = novaChaveIdempotencia()
      contas.recarregar()
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
    }
    setConfirmando(false)
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-manual">
      <LinkRota to="/financeiro">Voltar ao Financeiro</LinkRota>
      <TituloPagina id="titulo-manual">Lançamento manual</TituloPagina>
      <TextoSuave>
        Para receitas e despesas que não vêm de outro módulo (ex.: tarifa bancária, rendimento, outras entradas).
      </TextoSuave>
      {resultado && <ResultadoOperacao titulo="Lançamento registrado" resultado={resultado} onFechar={() => setResultado(null)} />}
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível registrar">
          {erro}
        </Aviso>
      )}
      {(contas.erro || categorias.erro) && (
        <Aviso tipo="error" titulo="Erro">
          {contas.erro ?? categorias.erro}
        </Aviso>
      )}
      <Pilha component="form" onSubmit={validar} noValidate spacing={2} aria-label="Novo lançamento manual">
        <Fieldset>
          <FormLabel component="legend">Tipo</FormLabel>
          <RadioGroup row value={campos.tipo} onChange={(e) => alterar({ tipo: e.target.value as TipoCategoria, categoria: '' })}>
            {(['RECEITA', 'DESPESA'] as TipoCategoria[]).map((t) => (
              <FormControlLabel key={t} value={t} control={<Radio />} label={ROTULO_TIPO_CATEGORIA[t]} />
            ))}
          </RadioGroup>
        </Fieldset>
        <GradeForm>
          <TextField select label="Conta" required value={campos.conta} onChange={(e) => alterar({ conta: Number(e.target.value) })}
            error={!!erros.contaId} helperText={erros.contaId ?? ' '}>
            {disponiveis.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nome}
              </MenuItem>
            ))}
          </TextField>
          <TextField type="date" label="Data" required value={campos.data} onChange={(e) => alterar({ data: e.target.value })}
            error={!!erros.data} helperText={erros.data ?? ' '}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: paraIsoData(hoje()) } }} />
          <SeletorCategoria
            key={`${campos.tipo}-${versao}`}
            categorias={categorias.dados ?? []}
            tipo={campos.tipo}
            filtro={permiteManual}
            valor={campos.categoria}
            onAlterar={(codigo) => alterar({ categoria: codigo })}
            erro={erros.categoria}
          />
          <CampoValor rotulo="Valor" valor={campos.valor} onAlterar={(v) => alterar({ valor: v })} ajuda={erros.valor ?? ' '} />
          <TextField label="Descrição" required value={campos.descricao} onChange={(e) => alterar({ descricao: e.target.value })}
            error={!!erros.descricao} helperText={erros.descricao ?? ' '} slotProps={{ htmlInput: { maxLength: 200 } }} />
        </GradeForm>
        <Fieldset>
          <FormLabel component="legend">Comprovante (opcional)</FormLabel>
          <LinhaAcoes>
            <Button variant="outlined" component="label">
              Selecionar arquivo
              <input key={versao} hidden type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Comprovante (opcional)"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </Button>
            <TextoSuave role={erros.anexo ? 'alert' : undefined}>{erros.anexo ?? (arquivo ? arquivo.name : 'PDF, JPG ou PNG de até 5 MB.')}</TextoSuave>
          </LinhaAcoes>
        </Fieldset>
        <LinhaAcoes>
          <Button type="submit" variant="contained">
            Registrar lançamento
          </Button>
        </LinhaAcoes>
      </Pilha>
      <DialogoAcao
        aberto={confirmando}
        titulo="Confirmar lançamento manual"
        textoConfirmar="Confirmar"
        onFechar={() => setConfirmando(false)}
        onConfirmar={() => void enviar()}
      >
        <TextoSuave>
          {ROTULO_TIPO_CATEGORIA[campos.tipo]} de {valor !== null && formatarMoeda(valor)} em {conta?.nome}, {formatarData(campos.data)}
          , {nomeCategoria}: “{campos.descricao.trim()}”. O lançamento não pode ser editado depois; correções são feitas por estorno.
        </TextoSuave>
      </DialogoAcao>
    </Pilha>
  )
}
