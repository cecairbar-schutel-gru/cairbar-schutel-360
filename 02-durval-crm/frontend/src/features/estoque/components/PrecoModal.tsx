import { TextField } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { DialogoAcao } from '../../../shared/components/DialogoAcao'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { CampoValor } from '../../../shared/pagamento/CamposPagamento'
import { lerValor, paraReais } from '../../../shared/pagamento/regras'
import { diferencaPercentual, formatarPercentual } from '../regras'
import { estoqueService } from '../services'

interface Props {
  produto: { id: number; nome: string; preco: number }
  /** Livro: o Administrador altera direto (US-INVENTORY-013); cantina: pedido de aprovação (US-INVENTORY-011). */
  modo: 'DIRETO' | 'SOLICITACAO'
  onFechar(): void
  onConcluido(mensagem: string): void
}

export function PrecoModal({ produto, modo, onFechar, onConcluido }: Props) {
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const centavos = lerValor(texto)
  const novo = centavos === null || Number.isNaN(centavos) ? null : paraReais(centavos)
  const valido = novo !== null && novo > 0

  async function enviar() {
    if (novo === null) return
    setEnviando(true)
    setErro(null)
    try {
      if (modo === 'DIRETO') {
        await estoqueService.alterarPrecoLivro(produto.id, novo, motivo.trim())
        onConcluido(`O preço de ${produto.nome} agora é ${formatarMoeda(novo)}.`)
      } else {
        await estoqueService.solicitarPreco(produto.id, novo, motivo.trim())
        onConcluido(`Pedido de novo preço de ${produto.nome} enviado para aprovação.`)
      }
    } catch (e) {
      setErro(mensagemDetalhada(e))
      setEnviando(false)
    }
  }

  return (
    <DialogoAcao
      aberto
      rotulo={produto.nome}
      titulo={modo === 'DIRETO' ? 'Alterar preço' : 'Solicitar novo preço'}
      textoConfirmar={modo === 'DIRETO' ? 'Alterar preço' : 'Enviar para aprovação'}
      confirmarDesabilitado={!valido || !motivo.trim() || enviando}
      onFechar={onFechar}
      onConfirmar={() => void enviar()}
    >
      <Pilha spacing={2}>
        <TextoSuave>
          Preço atual: {formatarMoeda(produto.preco)}.{' '}
          {modo === 'DIRETO'
            ? 'Vale para as próximas vendas; vendas passadas, obrigações e repasses das remessas não mudam.'
            : 'O preço atual continua valendo até a aprovação do Administrador.'}
        </TextoSuave>
        {erro && (
          <Aviso tipo="error" titulo="Não foi possível concluir">
            {erro}
          </Aviso>
        )}
        <CampoValor
          rotulo="Novo preço"
          valor={texto}
          onAlterar={setTexto}
          ajuda={valido ? `Diferença: ${formatarPercentual(diferencaPercentual(produto.preco, novo))}` : ' '}
        />
        <TextField label="Motivo" required multiline minRows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Pilha>
    </DialogoAcao>
  )
}
