import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { hoje, paraIsoData } from '../../../shared/formatters/datas'
import { errosPorCampo } from '../../doadores/components/errosDeCampo'
import { editoraService } from '../services'
import type { DetalheRemessa, Devolucao } from '../types'

/**
 * Devolução por remessa (US-PUBLISHER-005): quantidade por título até o restante; sem lançamento
 * financeiro nem obrigação.
 */
export function DevolucaoDialogo({
  remessa,
  onFechar,
  onDevolvida,
}: {
  remessa: DetalheRemessa
  onFechar(): void
  onDevolvida(devolucao: Devolucao): void
}) {
  const [data, setData] = useState(paraIsoData(hoje()))
  const [observacao, setObservacao] = useState('')
  const [quantidades, setQuantidades] = useState<Record<number, string>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const comSaldo = remessa.itens.filter((i) => i.restante > 0)

  async function confirmar() {
    const locais: Record<string, string> = {}
    const itens = comSaldo
      .map((i) => ({ produtoId: i.produtoId, quantidade: Number(quantidades[i.produtoId] || 0), restante: i.restante, titulo: i.titulo }))
      .filter((i) => i.quantidade !== 0)
    for (const i of itens) {
      if (!Number.isInteger(i.quantidade) || i.quantidade < 0) locais[`itens[${i.produtoId}]`] = 'Quantidade inválida.'
      else if (i.quantidade > i.restante) locais[`itens[${i.produtoId}]`] = `Restam só ${i.restante} unidade(s) de ${i.titulo} nesta remessa.`
    }
    if (itens.length === 0) locais.itens = 'Informe a quantidade devolvida de ao menos um título.'
    if (!data) locais.devolvidaEm = 'Informe a data da devolução.'
    setErros(locais)
    if (Object.keys(locais).length > 0) return
    setErro(null)
    try {
      onDevolvida(await editoraService.devolver(remessa.id, { devolvidaEm: data, observacao, itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })) }))
    } catch (falha) {
      setErros(errosPorCampo(falha))
      setErro(mensagemDeErro(falha))
    }
  }

  return (
    <DialogoAcao aberto titulo={`Devolução da remessa ${remessa.codigo}`} rotulo={remessa.editoraNome} textoConfirmar="Registrar devolução"
      onFechar={onFechar} onConfirmar={() => void confirmar()}>
      <Pilha spacing={2}>
        <TextoSuave>As unidades saem do estoque consignado desta remessa. Nenhum valor é lançado nem devido à editora.</TextoSuave>
        {erro && <Aviso tipo="error" titulo="Não foi possível registrar">{erro}</Aviso>}
        {erros.itens && <Aviso tipo="warning" titulo="Quantidades">{erros.itens}</Aviso>}
        <TableContainer>
          <Table size="small" aria-label="Quantidades devolvidas">
            <TableHead>
              <TableRow>
                <TableCell>Título</TableCell>
                <TableCell align="right">Restante</TableCell>
                <TableCell sx={{ width: '9rem' }}>Devolver</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comSaldo.map((i) => (
                <TableRow key={i.produtoId}>
                  <TableCell>{i.titulo}</TableCell>
                  <TableCell align="right">{i.restante}</TableCell>
                  <TableCell>
                    <TextField size="small" label={`Devolver de ${i.titulo}`} value={quantidades[i.produtoId] ?? ''}
                      onChange={(e) => setQuantidades((q) => ({ ...q, [i.produtoId]: e.target.value }))}
                      error={!!erros[`itens[${i.produtoId}]`]} helperText={erros[`itens[${i.produtoId}]`] ?? ' '}
                      slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TextField type="date" label="Data da devolução" required value={data} onChange={(e) => setData(e.target.value)}
          error={!!erros.devolvidaEm} helperText={erros.devolvidaEm ?? ' '}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: remessa.recebidaEm, max: paraIsoData(hoje()) } }} />
        <TextField label="Observação ou documento (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)}
          error={!!erros.observacao} helperText={erros.observacao ?? ' '} slotProps={{ htmlInput: { maxLength: 500 } }} />
      </Pilha>
    </DialogoAcao>
  )
}
