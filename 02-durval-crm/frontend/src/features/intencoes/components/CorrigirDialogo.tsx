import { Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraCentavos, paraReais, paraTextoDigitado } from '../../../shared/pagamento/regras'
import { intencaoService } from '../services'
import type { DetalheIntencao, ResultadoAcao } from '../types'

/**
 * "Corrigir" a compra divergente (US-EXPENSE-007): quantidades acordadas (zero tira o item) e o
 * valor pago. Valor diferente: a despesa é estornada e lançada de novo. Volta para o Vendedor conferir.
 */
export function CorrigirDialogo({ intencao: i, onFechar, onCorrigida }: { intencao: DetalheIntencao; onFechar(): void; onCorrigida(r: ResultadoAcao): void }) {
  const valorAtual = i.aprovacao!.valor
  const [quantidades, setQuantidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(i.itens.map((x) => [x.produtoId, String(x.quantidadeRecebida ?? x.quantidade)])),
  )
  const [valor, setValor] = useState(paraTextoDigitado(paraCentavos(valorAtual)))
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const centavos = lerValor(valor)
  const valido = centavos !== null && !Number.isNaN(centavos) && centavos > 0
  const quantidadesValidas = i.itens.every((x) => /^\d+$/.test(quantidades[x.produtoId] ?? ''))

  async function corrigir() {
    setEnviando(true)
    setErro(null)
    try {
      const novo = paraReais(centavos!)
      onCorrigida(
        await intencaoService.corrigir(
          i.id,
          i.itens.map((x) => ({ produtoId: x.produtoId, quantidade: Number(quantidades[x.produtoId]) })),
          paraCentavos(novo) === paraCentavos(valorAtual) ? null : novo,
          motivo,
        ),
      )
    } catch (falha) {
      setErro(mensagemDetalhada(falha))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={`Intenção nº ${i.id} · ${i.descricao}`}
      titulo="Corrigir compra divergente"
      textoConfirmar="Corrigir e devolver ao Vendedor"
      confirmarDesabilitado={enviando || !valido || !quantidadesValidas || !motivo.trim()}
      onFechar={onFechar}
      onConfirmar={() => void corrigir()}
    >
      <Pilha spacing={2}>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível corrigir">
            {erro}
          </Aviso>
        )}
        <TextoSuave>Divergência relatada: “{i.divergencia}”. Informe as quantidades acordadas com o fornecedor (zero tira o item).</TextoSuave>
        <Table size="small" aria-label="Quantidades acordadas">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell align="right">Aprovada</TableCell>
              <TableCell align="right">Recebida</TableCell>
              <TableCell align="right">Acordada</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {i.itens.map((x) => (
              <TableRow key={x.produtoId}>
                <TableCell>{x.produtoNome}</TableCell>
                <TableCell align="right">{x.quantidade}</TableCell>
                <TableCell align="right">{x.quantidadeRecebida ?? '—'}</TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    type="number"
                    value={quantidades[x.produtoId] ?? ''}
                    onChange={(e) => setQuantidades((q) => ({ ...q, [x.produtoId]: e.target.value }))}
                    slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': `Quantidade acordada de ${x.produtoNome}` } }}
                    sx={{ width: '6rem' }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CampoValor
          rotulo="Valor pago"
          valor={valor}
          onAlterar={setValor}
          ajuda={`Hoje a despesa é de ${formatarMoeda(valorAtual)}. Se mudar, ela é estornada e lançada com o novo valor.`}
        />
        <TextField label="Motivo da correção" required multiline minRows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Pilha>
    </DialogoAcao>
  )
}
