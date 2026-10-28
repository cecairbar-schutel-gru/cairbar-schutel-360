import {
  Box,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import logo from '../../../shared/assets/ce_cairbar_logo.png'
import { TextoSuave } from '../../../shared/components/layout'
import { formatarCompetencia, formatarDataHora, hoje } from '../../../shared/formatters/datas'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { rotuloPagamento } from '../../../shared/pagamento/regras'
import type { Recibo } from '../types'

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  const conteudo = (t: string) => (forte ? <strong>{t}</strong> : t)
  return (
    <TableRow>
      <TableCell sx={{ pl: 0 }}>{conteudo(rotulo)}</TableCell>
      <TableCell align="right" sx={{ pr: 0 }}>
        {conteudo(valor)}
      </TableCell>
    </TableRow>
  )
}

/** Comprovante digital (US-CONTRIB-009), no mesmo conteúdo do PDF. */
export function ReciboView({ recibo }: { recibo: Recibo }) {
  const cancelado = recibo.status === 'CANCELADA'
  return (
    <Card variant="outlined" sx={{ position: 'relative', overflow: 'hidden', maxWidth: '40rem' }}>
      {cancelado && (
        <Typography
          aria-hidden
          sx={(theme) => ({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(-30deg)',
            fontSize: '5rem',
            fontWeight: 700,
            color: theme.palette.error.main,
            opacity: 0.15,
            pointerEvents: 'none',
          })}
        >
          CANCELADO
        </Typography>
      )}
      <CardContent>
        <Box component="img" src={logo} alt="" sx={{ width: '12rem', display: 'block', mx: 'auto', mb: 2 }} />
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
          {recibo.organizacao.nome}
        </Typography>
        {recibo.organizacao.cnpj && <TextoSuave>CNPJ {recibo.organizacao.cnpj}</TextoSuave>}
        {recibo.organizacao.endereco && <TextoSuave>{recibo.organizacao.endereco}</TextoSuave>}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" component="h2">
          Recibo nº {recibo.numero}
        </Typography>
        {recibo.segundaVia && (
          <Typography sx={{ fontWeight: 600 }}>
            2ª via, emitida em {formatarDataHora(hoje().toISOString())}. Original de{' '}
            {formatarDataHora(recibo.recebidaEm)}.
          </Typography>
        )}
        {cancelado && (
          <Typography color="error" sx={{ fontWeight: 600 }}>
            Cancelado em {formatarDataHora(recibo.canceladaEm)}. Motivo: {recibo.motivoCancelamento}
          </Typography>
        )}
        <Table size="small" aria-label="Dados do recibo">
          <TableBody>
            <Linha rotulo="Data/hora" valor={formatarDataHora(recibo.recebidaEm)} />
            <Linha rotulo="Doador" valor={recibo.doadorNome} />
            {recibo.competencias.map((c) => (
              <Linha key={c.mes} rotulo={`Competência ${formatarCompetencia(c.mes)}`} valor={formatarMoeda(c.valor)} />
            ))}
            {recibo.valorDoacao > 0 && (
              <Linha
                rotulo={recibo.tipo === 'DOACAO_ANONIMA' ? 'Doação anônima' : 'Doação extraordinária'}
                valor={formatarMoeda(recibo.valorDoacao)}
              />
            )}
            {recibo.pagamentos.map((p, i) => (
              <Linha key={i} rotulo={`${rotuloPagamento(p)} (${p.contaNome})`} valor={formatarMoeda(p.valor)} />
            ))}
            <Linha rotulo="Total" valor={formatarMoeda(recibo.total)} forte />
          </TableBody>
        </Table>
        {recibo.observacao && <TextoSuave>Observação: {recibo.observacao}</TextoSuave>}
        <TextoSuave>
          Operador: {recibo.operadorNome}
        </TextoSuave>
        {recibo.organizacao.rodape && <TextoSuave>{recibo.organizacao.rodape}</TextoSuave>}
      </CardContent>
    </Card>
  )
}
