import { Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { LinkRota } from '../../../shared/components/LinkRota'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { formatarData, formatarDataHora } from '../../../shared/formatters/datas'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { erroJanela, MAXIMO_DIAS_JANELA, ULTIMO_DIA_JANELA } from '../regras'
import { fechamentoService } from '../services'
import type { SituacaoJanela } from '../types'

const DIAS = Array.from({ length: ULTIMO_DIA_JANELA }, (_, i) => i + 1)

/**
 * Janela de fechamento (US-CLOSING-014): o Tesoureiro ou o Administrador escolhe os dias de cada mês, de 1 a
 * 7 seguidos, em que o mês anterior pode ser fechado. Fora deles, "Fechar período" fica desabilitado.
 */
export function JanelaFechamentoPage() {
  const situacao = useCarregamento(() => fechamentoService.janela(), [])
  const [mensagem, setMensagem] = useState<string | null>(null)

  if (situacao.carregando && !situacao.dados) return <Carregando />
  if (situacao.erro || !situacao.dados) {
    return (
      <Aviso tipo="error" titulo="Erro">
        {situacao.erro ?? 'Não foi possível carregar a janela de fechamento.'}
      </Aviso>
    )
  }
  const s = situacao.dados

  return (
    <Pilha component="section" aria-labelledby="titulo-janela">
      <LinkRota to="/administracao">Voltar às Configurações</LinkRota>
      <TituloPagina id="titulo-janela">Janela de fechamento</TituloPagina>
      <TextoSuave>
        Dias de cada mês em que o Tesoureiro ou o Administrador pode fechar o mês anterior (e os atrasados, em ordem),
        pelo botão “Fechar período” do Fechamento mensal. A janela tem de 1 a {MAXIMO_DIAS_JANELA} dias seguidos,
        até o dia {ULTIMO_DIA_JANELA}, que existe em todo mês.
      </TextoSuave>
      {mensagem && (
        <Aviso tipo="success" titulo="Pronto" onFechar={() => setMensagem(null)}>
          {mensagem}
        </Aviso>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" component="p" color="text.secondary">
            Janela atual
          </Typography>
          <Typography variant="h5" component="p" color="primary.dark">
            Do dia {s.diaInicio} ao dia {s.diaFim}
          </Typography>
          <Typography variant="body2" component="p" color="text.secondary">
            {s.aberta
              ? `Aberta agora, até ${formatarData(s.fim)}.`
              : `Próxima: de ${formatarData(s.inicio)} a ${formatarData(s.fim)}.`}
            {s.alteradoEm ? ` Alterada por ${s.alteradoPor} em ${formatarDataHora(s.alteradoEm)}.` : ' Padrão do sistema.'}
          </Typography>
        </CardContent>
      </Card>

      <FormularioJanela
        key={`${s.diaInicio}-${s.diaFim}`}
        atual={s}
        onSalva={(nova) => {
          setMensagem(`Janela alterada: do dia ${nova.diaInicio} ao dia ${nova.diaFim} de cada mês.`)
          situacao.recarregar()
        }}
      />
    </Pilha>
  )
}

function FormularioJanela({ atual, onSalva }: { atual: SituacaoJanela; onSalva(nova: SituacaoJanela): void }) {
  const [diaInicio, setDiaInicio] = useState(atual.diaInicio)
  const [diaFim, setDiaFim] = useState(atual.diaFim)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const invalida = erroJanela(diaInicio, diaFim)
  const semMudanca = diaInicio === atual.diaInicio && diaFim === atual.diaFim

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      onSalva(await fechamentoService.alterarJanela(diaInicio, diaFim))
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {erro && (
        <Aviso tipo="error" titulo="Não foi possível salvar" onFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      )}
      <GradeForm>
        <TextField select label="Primeiro dia" value={diaInicio} onChange={(e) => setDiaInicio(Number(e.target.value))}>
          {DIAS.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Último dia"
          value={diaFim}
          onChange={(e) => setDiaFim(Number(e.target.value))}
          error={invalida !== null}
          helperText={invalida ?? `${diaFim - diaInicio + 1} de no máximo ${MAXIMO_DIAS_JANELA} dias.`}
        >
          {DIAS.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
      </GradeForm>
      <LinhaAcoes>
        <Button variant="contained" disabled={invalida !== null || semMudanca || salvando} onClick={() => void salvar()}>
          Salvar janela
        </Button>
      </LinhaAcoes>
    </>
  )
}
