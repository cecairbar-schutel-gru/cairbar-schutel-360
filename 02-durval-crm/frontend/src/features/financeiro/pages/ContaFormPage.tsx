import { Button, MenuItem, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { hoje, paraIsoData } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { lerValor, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { ROTULO_TIPO_CONTA } from '../rotulos'
import { financeiroService } from '../services'
import type { ContaFinanceira, TipoConta } from '../types'

interface Campos {
  tipo: TipoConta
  nome: string
  localizacao: string
  banco: string
  agencia: string
  numeroConta: string
  saldoInicial: string
  dataCorte: string
}

function deConta(c: ContaFinanceira): Campos {
  return {
    tipo: c.tipo,
    nome: c.nome,
    localizacao: c.localizacao ?? '',
    banco: c.banco ?? '',
    agencia: c.agencia ?? '',
    numeroConta: c.numeroConta ?? '',
    saldoInicial: paraTextoDigitado(Math.round(c.saldoInicial * 100)),
    dataCorte: c.dataCorte,
  }
}

/**
 * Cadastro e alteração de caixa (dinheiro em espécie) ou conta bancária (US-FINANCIAL-001). O Tesoureiro só
 * cadastra e altera contas bancárias; caixas ficam com o Administrador. O código é gerado do nome.
 */
export function ContaFormPage() {
  const { id } = useParams()
  const conta = useCarregamento(() => (id ? financeiroService.conta(Number(id)) : Promise.resolve(null)), [id])
  if (conta.carregando) return <Carregando />
  if (conta.erro) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {conta.erro}
      </Aviso>
    )
  }
  return <FormularioConta key={id ?? 'nova'} conta={conta.dados} />
}

function FormularioConta({ conta }: { conta: ContaFinanceira | null }) {
  const navegar = useNavigate()
  const { perfilAtivo } = useAuth()
  const tipos: TipoConta[] = perfilAtivo === 'administrador' ? ['CAIXA', 'BANCO'] : ['BANCO']
  const edicao = conta !== null
  const [campos, setCampos] = useState<Campos>(() =>
    conta
      ? deConta(conta)
      : { tipo: tipos[0], nome: '', localizacao: '', banco: '', agencia: '', numeroConta: '', saldoInicial: '0,00', dataCorte: paraIsoData(hoje()) },
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const travado = !!conta?.temLancamentos
  const alterar = (parcial: Partial<Campos>) => setCampos((c) => ({ ...c, ...parcial }))
  const banco = campos.tipo === 'BANCO'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const locais: Record<string, string> = {}
    if (!campos.nome.trim()) locais.nome = 'Informe o nome da conta.'
    const texto = campos.saldoInicial.trim().replace(/^-/, '')
    const centavos = lerValor(texto)
    if (centavos === null || Number.isNaN(centavos)) locais.saldoInicial = 'Informe o saldo inicial (pode ser zero).'
    const negativo = campos.saldoInicial.trim().startsWith('-')
    if (negativo && !banco) locais.saldoInicial = 'O saldo inicial do caixa não pode ser negativo.'
    if (!campos.dataCorte) locais.dataCorte = 'Informe a data de corte.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    const saldoInicial = paraReais(centavos!) * (negativo ? -1 : 1)
    setEnviando(true)
    setErro(null)
    try {
      const dados = { ...campos, saldoInicial }
      if (edicao) await financeiroService.alterarConta(conta.id, dados)
      else await financeiroService.cadastrarConta(dados)
      navegar('/financeiro/contas')
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  const titulo = edicao ? `Editar ${conta.nome}` : 'Nova conta'
  return (
    <Pilha component="section" aria-labelledby="titulo-form-conta">
      <LinkRota to="/financeiro/contas">Voltar às contas</LinkRota>
      <TituloPagina id="titulo-form-conta">{titulo}</TituloPagina>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar">
          {erro}
        </Aviso>
      )}
      {travado && (
        <Aviso tipo="info" titulo="Conta com lançamentos">
          O saldo inicial e a data de corte não podem mais ser alterados.
        </Aviso>
      )}
      <Pilha component="form" onSubmit={salvar} noValidate spacing={2} aria-label={titulo}>
        <GradeForm>
          <TextField
            select
            label="Tipo"
            value={campos.tipo}
            onChange={(e) => alterar({ tipo: e.target.value as TipoConta })}
            disabled={edicao}
          >
            {(edicao ? [campos.tipo] : tipos).map((t) => (
              <MenuItem key={t} value={t}>
                {ROTULO_TIPO_CONTA[t]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Nome"
            required
            value={campos.nome}
            onChange={(e) => alterar({ nome: e.target.value })}
            error={!!erros.nome}
            helperText={erros.nome}
          />
          {banco ? (
            <>
              <TextField label="Banco" required value={campos.banco} onChange={(e) => alterar({ banco: e.target.value })}
                error={!!erros.banco} helperText={erros.banco} />
              <TextField label="Agência" required value={campos.agencia} onChange={(e) => alterar({ agencia: e.target.value })}
                error={!!erros.agencia} helperText={erros.agencia} />
              <TextField label="Número da conta" required value={campos.numeroConta}
                onChange={(e) => alterar({ numeroConta: e.target.value })} error={!!erros.numeroConta} helperText={erros.numeroConta} />
            </>
          ) : (
            campos.tipo === 'CAIXA' && (
              <TextField label="Localização" value={campos.localizacao} onChange={(e) => alterar({ localizacao: e.target.value })}
                error={!!erros.localizacao} helperText={erros.localizacao} />
            )
          )}
          <TextField
            label="Saldo inicial"
            required
            value={campos.saldoInicial}
            onChange={(e) => alterar({ saldoInicial: e.target.value })}
            disabled={travado}
            error={!!erros.saldoInicial}
            helperText={erros.saldoInicial ?? 'Saldo na data de corte.'}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            type="date"
            label="Data de corte"
            required
            value={campos.dataCorte}
            onChange={(e) => alterar({ dataCorte: e.target.value })}
            disabled={travado}
            error={!!erros.dataCorte}
            helperText={erros.dataCorte ?? 'Nenhum lançamento pode ter data anterior.'}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </GradeForm>
        {!edicao && <TextoSuave>Cartão a receber é única e já foi criada pelo sistema.</TextoSuave>}
        <LinhaAcoes>
          <Button onClick={() => navegar('/financeiro/contas')}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={enviando}>
            Salvar
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
