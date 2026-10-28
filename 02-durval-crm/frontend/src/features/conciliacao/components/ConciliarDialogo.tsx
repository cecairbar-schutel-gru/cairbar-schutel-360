import DescriptionIcon from '@mui/icons-material/Description'
import TableChartIcon from '@mui/icons-material/TableChart'
import {
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarData } from '../../../shared/formatters/datas'
import type { ContaParaConciliar, FormatoExtrato } from '../types'

interface Props {
  contas: ContaParaConciliar[]
  onFechar(): void
  onContinuar(conta: ContaParaConciliar, formato: FormatoExtrato): void
}

const FORMATOS: {
  formato: FormatoExtrato
  titulo: string
  descricao: string
  icone: typeof DescriptionIcon
}[] = [
  {
    formato: 'OFX',
    titulo: 'OFX (recomendado)',
    descricao:
      'Arquivo padrão dos bancos (Extrato › Exportar › OFX/Money). Traz também o saldo e a data do extrato.',
    icone: DescriptionIcon,
  },
  {
    formato: 'CSV',
    titulo: 'CSV',
    descricao:
      'Planilha exportada do internet banking (CSV/Excel). Você indica as colunas de data, descrição e valor.',
    icone: TableChartIcon,
  },
]

/**
 * Início da conciliação pela página: escolhe a conta bancária e o formato do extrato (OFX ou CSV)
 * que será importado. Conta com sessão em andamento retoma a sessão; sem sessão, inicia uma.
 */
export function ConciliarDialogo({ contas, onFechar, onContinuar }: Props) {
  const [contaId, setContaId] = useState<number | ''>(
    contas.length === 1 ? contas[0].contaId : '',
  )
  const [formato, setFormato] = useState<FormatoExtrato>('OFX')
  const conta = contas.find((c) => c.contaId === contaId)

  return (
    <DialogoAcao
      aberto
      titulo="Conciliar"
      textoConfirmar="Continuar"
      confirmarDesabilitado={!conta}
      onFechar={onFechar}
      onConfirmar={() => conta && onContinuar(conta, formato)}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          Escolha a conta bancária e o formato do extrato exportado do banco. Em
          seguida você envia o arquivo e confere a prévia antes de importar.
        </TextoSuave>
        {contas.length === 0 ? (
          <TextoSuave>
            Nenhuma conta bancária ativa: cadastre a conta no Financeiro para
            conciliar.
          </TextoSuave>
        ) : (
          <TextField
            select
            label="Conta bancária"
            required
            value={contaId}
            onChange={(e) => setContaId(Number(e.target.value))}
            helperText={
              conta &&
              (conta.sessaoId !== null
                ? `Conciliação em andamento (extrato até ${formatarData(conta.sessaoDataFim)}): o extrato entra nela.`
                : conta.conciliadaAte
                  ? `Conciliada até ${formatarData(conta.conciliadaAte)}.`
                  : 'Primeira conciliação desta conta.')
            }
          >
            {contas.map((c) => (
              <MenuItem key={c.contaId} value={c.contaId}>
                {c.contaNome}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Pilha spacing={1} component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
          <Typography component="legend" variant="subtitle2">
            Formato do extrato
          </Typography>
          <RadioGroup
            value={formato}
            onChange={(e) => setFormato(e.target.value as FormatoExtrato)}
            sx={{ gap: 1 }}
          >
            {FORMATOS.map(({ formato: f, titulo, descricao, icone: Icone }) => (
              <FormControlLabel
                key={f}
                value={f}
                control={<Radio />}
                sx={{
                  m: 0,
                  p: 1.5,
                  border: 1,
                  borderRadius: 1,
                  alignItems: 'flex-start',
                  borderColor: formato === f ? 'primary.main' : 'divider',
                  bgcolor: formato === f ? 'action.selected' : 'transparent',
                }}
                label={
                  <Pilha spacing={0.5} sx={{ pt: 1 }}>
                    <Typography
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Icone fontSize="small" color="primary" />
                      {titulo}
                    </Typography>
                    <TextoSuave>{descricao}</TextoSuave>
                  </Pilha>
                }
              />
            ))}
          </RadioGroup>
        </Pilha>
      </Pilha>
    </DialogoAcao>
  )
}
