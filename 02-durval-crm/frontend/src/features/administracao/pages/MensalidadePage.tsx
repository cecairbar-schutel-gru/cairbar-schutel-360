import { Button, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Indicador } from '../../../shared/components/Indicador'
import { LinkRota } from '../../../shared/components/LinkRota'
import { CampoMes } from '../../../shared/components/CampoMes'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarCompetencia, formatarDataHora } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { erroNovoValor, primeiroMesPermitido } from '../regras'
import { administracaoService } from '../services'
import type { SituacaoMensalidade, ValorMensalidade } from '../types'

type Modo = 'agendar' | 'alterar'

/**
 * Valor da mensalidade (US-ADMIN-002): vigente, histórico e uma alteração agendada por vez, a partir
 * do mês seguinte. Competências já geradas (pendentes ou pagas, inclusive antecipadas) mantêm o valor.
 */
export function MensalidadePage() {
  const situacao = useCarregamento(() => administracaoService.mensalidade(), [])
  const [modo, setModo] = useState<Modo | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  async function executar(acao: () => Promise<SituacaoMensalidade>, sucesso: string) {
    setErro(null)
    try {
      await acao()
      setMensagem(sucesso)
      setModo(null)
      setCancelando(false)
      situacao.recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    }
  }

  if (situacao.carregando) return <Carregando />
  if (situacao.erro || !situacao.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {situacao.erro ?? 'Não foi possível carregar a mensalidade.'}
      </Aviso>
    )
  }
  const s = situacao.dados
  return (
    <Pilha component="section" aria-labelledby="titulo-mensalidade">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-mensalidade">Valor da mensalidade</TituloPagina>
      <TextoSuave>
        O valor é único para todos os doadores. Um novo valor vale para as competências geradas a partir do mês
        escolhido; as já geradas, pendentes ou pagas, continuam com o valor que tinham.
      </TextoSuave>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}
      <GradeForm>
        <Indicador rotulo="Valor vigente" valor={formatarMoeda(s.vigente.valor)} detalhe={`Desde ${formatarCompetencia(s.vigente.vigenteDe)}`} />
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" component="p" color="text.secondary">
              Alteração agendada
            </Typography>
            {s.agendada ? (
              <>
                <Typography variant="h4" component="p" color="primary.dark">
                  {formatarMoeda(s.agendada.valor)}
                </Typography>
                <Typography variant="caption" component="p" color="text.secondary">
                  A partir de {formatarCompetencia(s.agendada.vigenteDe)} · {s.agendada.motivo}
                </Typography>
                <LinhaAcoes sx={{ mt: 1 }}>
                  <Button size="small" onClick={() => setModo('alterar')}>
                    Alterar
                  </Button>
                  <Button size="small" color="error" onClick={() => setCancelando(true)}>
                    Cancelar agendamento
                  </Button>
                </LinhaAcoes>
              </>
            ) : (
              <>
                <Typography variant="body1" component="p" sx={{ my: 1 }}>
                  Nenhuma
                </Typography>
                <Button variant="contained" onClick={() => setModo('agendar')}>
                  Definir novo valor
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </GradeForm>

      <Typography variant="h6" component="h2">
        Histórico
      </Typography>
      <TableContainer>
        <Table size="small" aria-label="Histórico de valores da mensalidade">
          <TableHead>
            <TableRow>
              <TableCell>A partir de</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Definido por</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {s.historico.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  {formatarCompetencia(v.vigenteDe)}
                  {v.id === s.agendada?.id ? ' (agendado)' : v.id === s.vigente.id ? ' (vigente)' : ''}
                </TableCell>
                <TableCell align="right">{formatarMoeda(v.valor)}</TableCell>
                <TableCell>{v.motivo ?? '—'}</TableCell>
                <TableCell>
                  {v.autor.nome ?? v.autor.subject} · {formatarDataHora(v.autor.em)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {modo && (
        <DialogoNovoValor
          modo={modo}
          situacao={s}
          inicial={modo === 'alterar' ? s.agendada : null}
          erro={erro}
          onFechar={() => {
            setModo(null)
            setErro(null)
          }}
          onConfirmar={(dados) =>
            void executar(
              () => (modo === 'agendar' ? administracaoService.agendarMensalidade(dados) : administracaoService.alterarAgendamento(dados)),
              `Novo valor de ${formatarMoeda(dados.valor)} a partir de ${formatarCompetencia(dados.vigenteDe)}.`,
            )
          }
        />
      )}
      {cancelando && (
        <DialogoAcao
          aberto
          titulo="Cancelar agendamento"
          textoConfirmar="Cancelar agendamento"
          perigo
          onFechar={() => {
            setCancelando(false)
            setErro(null)
          }}
          onConfirmar={() => void executar(() => administracaoService.cancelarAgendamento(), 'Agendamento cancelado.')}
        >
          {erro && (
            <Aviso tipo="error" titulo="Não foi possível concluir">
              {erro}
            </Aviso>
          )}
          <TextoSuave>O valor vigente continua valendo para os próximos meses.</TextoSuave>
        </DialogoAcao>
      )}
    </Pilha>
  )
}

function DialogoNovoValor({
  modo,
  situacao,
  inicial,
  erro,
  onFechar,
  onConfirmar,
}: {
  modo: Modo
  situacao: SituacaoMensalidade
  inicial: ValorMensalidade | null
  erro: string | null
  onFechar(): void
  onConfirmar(dados: { valor: number; vigenteDe: string; motivo: string }): void
}) {
  const [valor, setValor] = useState(inicial ? String(inicial.valor).replace('.', ',') : '')
  const [vigenteDe, setVigenteDe] = useState(inicial?.vigenteDe ?? primeiroMesPermitido(situacao.mesAtual))
  const [motivo, setMotivo] = useState(inicial?.motivo ?? '')
  const [tentou, setTentou] = useState(false)
  const numero = valor.trim() ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
  const problema = erroNovoValor(numero, vigenteDe, motivo, situacao.mesAtual, situacao.vigente.valor)
  return (
    <DialogoAcao
      aberto
      titulo={modo === 'agendar' ? 'Novo valor da mensalidade' : 'Alterar valor agendado'}
      textoConfirmar="Confirmar"
      onFechar={onFechar}
      onConfirmar={() => {
        setTentou(true)
        if (!problema && numero !== null) onConfirmar({ valor: numero, vigenteDe, motivo: motivo.trim() })
      }}
    >
      <Pilha spacing={2}>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível concluir">
            {erro}
          </Aviso>
        )}
        {tentou && problema && (
          <Aviso tipo="warning" titulo="Confira os dados">
            {problema}
          </Aviso>
        )}
        <TextField
          label="Novo valor (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          helperText={`Valor vigente: ${formatarMoeda(situacao.vigente.valor)}`}
          required
        />
        <CampoMes
          rotulo="A partir de"
          valor={vigenteDe}
          onAlterar={setVigenteDe}
          min={primeiroMesPermitido(situacao.mesAtual)}
          textoAjuda={`O mês seguinte (${formatarCompetencia(primeiroMesPermitido(situacao.mesAtual))}) ou depois.`}
          required
        />
        <TextField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} multiline minRows={2} required />
        <TextoSuave>
          As competências de {formatarCompetencia(vigenteDe || primeiroMesPermitido(situacao.mesAtual))} em diante serão
          geradas com o novo valor. As competências já geradas não mudam.
        </TextoSuave>
      </Pilha>
    </DialogoAcao>
  )
}
