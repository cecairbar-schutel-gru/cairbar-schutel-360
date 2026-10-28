import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha } from '../../../shared/components/layout'
import { mensagemDeErro } from '../../../shared/api/http'
import { formatarCompetencia } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { competenciaService } from '../../contribuicoes/services/CompetenciaService'
import { doadorService } from '../services'
import type { DecisaoPendencias, Doador } from '../types'
import { errosPorCampo } from './errosDeCampo'

interface BaseProps {
  doador: Doador
  aberto: boolean
  onFechar(): void
  onConcluido(doador: Doador): void
}

function useAcao(onConcluido: (d: Doador) => void) {
  const [executando, setExecutando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})

  async function executar(operacao: () => Promise<Doador>) {
    setExecutando(true)
    setFalha(null)
    setErros({})
    try {
      onConcluido(await operacao())
    } catch (e) {
      setErros(errosPorCampo(e))
      setFalha(mensagemDeErro(e))
    } finally {
      setExecutando(false)
    }
  }
  return { executando, falha, erros, executar }
}

function DecisaoPendenciasCampo({
  doadorId,
  valor,
  onChange,
  erro,
}: {
  doadorId: number
  valor: DecisaoPendencias | ''
  onChange(v: DecisaoPendencias): void
  erro?: string
}) {
  const { dados } = useCarregamento(
    () => competenciaService.listarPorDoador(doadorId),
    [doadorId],
  )
  const pendentes = (dados ?? []).filter((c) => c.status === 'PENDENTE')
  const total = pendentes.reduce((s, c) => s + c.valor, 0)

  return (
    <Pilha>
      <div>
        <Typography variant="subtitle2" color="text.secondary">
          Competências pendentes
        </Typography>
        {pendentes.length === 0 ? (
          <Typography>Nenhuma competência pendente.</Typography>
        ) : (
          <Typography>
            {pendentes
              .map((c) => formatarCompetencia(c.competencia))
              .join(', ')}{' '}
            — total <strong>{formatarMoeda(total)}</strong> ({pendentes.length})
          </Typography>
        )}
      </div>
      <FormControl component="fieldset" error={!!erro}>
        <FormLabel component="legend">O que fazer com as pendências?</FormLabel>
        <RadioGroup
          name="decisao-pendencias"
          value={valor}
          onChange={(e) => onChange(e.target.value as DecisaoPendencias)}
        >
          <FormControlLabel
            value="MANTER"
            control={<Radio id="pend-manter" />}
            label="Manter pendentes (ainda podem ser pagas)"
          />
          <FormControlLabel
            value="CANCELAR"
            control={<Radio id="pend-cancelar" />}
            label="Cancelar pendentes (mantêm o valor original no histórico)"
          />
        </RadioGroup>
        {erro && <FormHelperText>{erro}</FormHelperText>}
      </FormControl>
    </Pilha>
  )
}

function CampoMotivo({
  id,
  rotulo,
  valor,
  onChange,
  invalido,
  erro,
}: {
  id: string
  rotulo: string
  valor: string
  onChange(v: string): void
  invalido: boolean
  erro?: string
}) {
  return (
    <TextField
      id={id}
      label={rotulo}
      multiline
      minRows={3}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      error={invalido}
      helperText={invalido ? (erro ?? 'Informe o motivo.') : undefined}
    />
  )
}

export function InativarDoadorModal({
  doador,
  aberto,
  onFechar,
  onConcluido,
}: BaseProps) {
  const [motivo, setMotivo] = useState('')
  const [pendencias, setPendencias] = useState<DecisaoPendencias | ''>('')
  const { executando, falha, erros, executar } = useAcao(onConcluido)
  const [tentou, setTentou] = useState(false)
  const semMotivo = tentou && !motivo.trim()
  const semDecisao = tentou && !pendencias

  return (
    <DialogoAcao
      aberto={aberto}
      titulo="Inativar doador"
      rotulo={doador.nome}
      textoConfirmar={executando ? 'Inativando…' : 'Inativar doador'}
      perigo
      confirmarDesabilitado={executando}
      onFechar={onFechar}
      onConfirmar={() => {
        setTentou(true)
        if (!motivo.trim() || !pendencias) return
        void executar(() =>
          doadorService.inativar(doador.id, { motivo, pendencias }),
        )
      }}
    >
      <Pilha>
        <Typography>
          Doadores inativos deixam de gerar novas competências. Pagamentos já
          feitos nunca são alterados.
        </Typography>
        <DecisaoPendenciasCampo
          doadorId={doador.id}
          valor={pendencias}
          onChange={setPendencias}
          erro={
            semDecisao
              ? 'Escolha o que fazer com as pendências.'
              : erros.pendencias
          }
        />
        <CampoMotivo
          id="inativar-motivo"
          rotulo="Motivo da inativação"
          valor={motivo}
          onChange={setMotivo}
          invalido={semMotivo || !!erros.motivo}
          erro={erros.motivo}
        />
        {falha && !Object.keys(erros).length && (
          <Aviso tipo="error" titulo="Erro">
            {falha}
          </Aviso>
        )}
      </Pilha>
    </DialogoAcao>
  )
}

export function ReativarDoadorModal({
  doador,
  aberto,
  onFechar,
  onConcluido,
}: BaseProps) {
  const [motivo, setMotivo] = useState('')
  const { executando, falha, erros, executar } = useAcao(onConcluido)
  const [tentou, setTentou] = useState(false)

  return (
    <DialogoAcao
      aberto={aberto}
      titulo="Reativar doador"
      rotulo={doador.nome}
      textoConfirmar={executando ? 'Reativando…' : 'Reativar doador'}
      confirmarDesabilitado={executando}
      onFechar={onFechar}
      onConfirmar={() => {
        setTentou(true)
        if (!motivo.trim()) return
        void executar(() => doadorService.reativar(doador.id, { motivo }))
      }}
    >
      <Pilha>
        <Typography>
          A competência do mês atual será gerada agora. Não são criadas
          competências para os meses em que o doador esteve inativo, e as já
          canceladas continuam canceladas.
        </Typography>
        <CampoMotivo
          id="reativar-motivo"
          rotulo="Motivo da reativação"
          valor={motivo}
          onChange={setMotivo}
          invalido={(tentou && !motivo.trim()) || !!erros.motivo}
          erro={erros.motivo}
        />
        {falha && !Object.keys(erros).length && (
          <Aviso tipo="error" titulo="Erro">
            {falha}
          </Aviso>
        )}
      </Pilha>
    </DialogoAcao>
  )
}

export function AnonimizarDoadorModal({
  doador,
  aberto,
  onFechar,
  onConcluido,
}: BaseProps) {
  const [motivo, setMotivo] = useState('')
  const [nomeConfirmacao, setNomeConfirmacao] = useState('')
  const [pendencias, setPendencias] = useState<DecisaoPendencias | ''>('')
  const { executando, falha, erros, executar } = useAcao(onConcluido)
  const [tentou, setTentou] = useState(false)
  const ativo = doador.status === 'ATIVO'
  const nomeConfere =
    nomeConfirmacao.trim().toLowerCase() === doador.nome.trim().toLowerCase()

  return (
    <DialogoAcao
      aberto={aberto}
      titulo="Anonimizar doador (LGPD)"
      rotulo={doador.nome}
      textoConfirmar={
        executando ? 'Anonimizando…' : 'Anonimizar definitivamente'
      }
      perigo
      confirmarDesabilitado={executando || !nomeConfere}
      onFechar={onFechar}
      onConfirmar={() => {
        setTentou(true)
        if (!motivo.trim() || !nomeConfere || (ativo && !pendencias)) return
        void executar(() =>
          doadorService.anonimizar(doador.id, {
            motivo,
            nomeConfirmacao,
            pendencias: ativo ? (pendencias as DecisaoPendencias) : undefined,
          }),
        )
      }}
    >
      <Pilha>
        <Aviso tipo="warning" titulo="Ação irreversível">
          Nome, CPF, nascimento, contatos, endereço, notas e consentimentos
          serão apagados. Contribuições e lançamentos financeiros são mantidos.
        </Aviso>
        {ativo && (
          <>
            <Typography>
              Este doador está ativo e será inativado antes de ser anonimizado.
            </Typography>
            <DecisaoPendenciasCampo
              doadorId={doador.id}
              valor={pendencias}
              onChange={setPendencias}
              erro={
                tentou && !pendencias
                  ? 'Escolha o que fazer com as pendências.'
                  : erros.pendencias
              }
            />
          </>
        )}
        <CampoMotivo
          id="anonimizar-motivo"
          rotulo="Motivo da solicitação"
          valor={motivo}
          onChange={setMotivo}
          invalido={(tentou && !motivo.trim()) || !!erros.motivo}
          erro={erros.motivo}
        />
        <TextField
          id="anonimizar-confirmacao"
          label={`Digite o nome do doador para confirmar: ${doador.nome}`}
          value={nomeConfirmacao}
          onChange={(e) => setNomeConfirmacao(e.target.value)}
          error={!!erros.nomeConfirmacao}
          helperText={erros.nomeConfirmacao}
        />
        {falha && !Object.keys(erros).length && (
          <Aviso tipo="error" titulo="Erro">
            {falha}
          </Aviso>
        )}
      </Pilha>
    </DialogoAcao>
  )
}
