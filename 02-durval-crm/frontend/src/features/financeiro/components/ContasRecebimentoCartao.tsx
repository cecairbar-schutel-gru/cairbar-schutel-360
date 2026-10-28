import { Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { mensagemDetalhada } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { GradeForm, LinhaAcoes, Pilha, TextoSuave } from '../../../shared/components/layout'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { financeiroService } from '../services'
import type { ContaFinanceira } from '../types'

interface Props {
  /** Contas do cadastro, para escolher os destinos. */
  contas: ContaFinanceira[]
  /** Só o Administrador altera; o Tesoureiro vê. */
  editavel: boolean
}

/**
 * Contas de recebimento: onde entram o dinheiro e o PIX das vendas e contribuições. Quem vende ou
 * recebe só informa a forma e o valor; o cartão vai sempre para Cartão a receber.
 */
export function ContasRecebimentoCartao({ contas, editavel }: Props) {
  const atuais = useCarregamento(() => financeiroService.contasRecebimento(), [])
  const [editando, setEditando] = useState(false)
  const [dinheiro, setDinheiro] = useState('')
  const [pix, setPix] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const caixas = contas.filter((c) => c.tipo === 'CAIXA' && c.ativa)
  const bancos = contas.filter((c) => c.tipo === 'BANCO' && c.ativa)

  function abrir() {
    setDinheiro(String(atuais.dados?.dinheiro?.id ?? ''))
    setPix(String(atuais.dados?.pix?.id ?? ''))
    setErro(null)
    setEditando(true)
  }

  async function salvar() {
    setEnviando(true)
    setErro(null)
    try {
      await financeiroService.definirContasRecebimento(dinheiro ? Number(dinheiro) : null, pix ? Number(pix) : null)
      setEditando(false)
      atuais.recarregar()
    } catch (e) {
      setErro(mensagemDetalhada(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card variant="outlined" component="section" aria-labelledby="titulo-recebimento">
      <CardContent>
        <Pilha spacing={2}>
          <Typography id="titulo-recebimento" variant="h6" component="h2">
            Contas de recebimento
          </Typography>
          <TextoSuave>
            Vendas e contribuições entram nestas contas conforme a forma de pagamento; quem vende ou recebe não escolhe
            conta.
          </TextoSuave>
          {atuais.carregando && <Carregando />}
          {atuais.erro && (
            <Aviso tipo="error" titulo="Erro">
              {atuais.erro}
            </Aviso>
          )}
          {erro && (
            <Aviso tipo="error" titulo="Não foi possível salvar">
              {erro}
            </Aviso>
          )}
          {atuais.dados && !editando && (
            <>
              <dl aria-label="Destino de cada forma de pagamento" style={{ margin: 0 }}>
                <Destino forma="Dinheiro" conta={atuais.dados.dinheiro?.nome} />
                <Destino forma="PIX" conta={atuais.dados.pix?.nome} />
                <Destino forma="Cartão" conta={atuais.dados.cartao.nome} />
              </dl>
              {(!atuais.dados.dinheiro || !atuais.dados.pix) && (
                <Aviso tipo="warning" titulo="Forma de pagamento sem conta">
                  Enquanto a conta não for definida, vendas e contribuições nessa forma não são aceitas.
                </Aviso>
              )}
              {editavel && (
                <LinhaAcoes>
                  <Button variant="outlined" onClick={abrir}>
                    Alterar contas de recebimento
                  </Button>
                </LinhaAcoes>
              )}
            </>
          )}
          {editando && (
            <>
              <GradeForm>
                <TextField select label="Dinheiro entra em" value={dinheiro} onChange={(e) => setDinheiro(e.target.value)}>
                  <MenuItem value="">Nenhuma (não aceitar dinheiro)</MenuItem>
                  {caixas.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField select label="PIX entra em" value={pix} onChange={(e) => setPix(e.target.value)}>
                  <MenuItem value="">Nenhuma (não aceitar PIX)</MenuItem>
                  {bancos.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </MenuItem>
                  ))}
                </TextField>
              </GradeForm>
              <LinhaAcoes>
                <Button variant="contained" onClick={() => void salvar()} disabled={enviando}>
                  Salvar
                </Button>
                <Button onClick={() => setEditando(false)} disabled={enviando}>
                  Cancelar
                </Button>
              </LinhaAcoes>
            </>
          )}
        </Pilha>
      </CardContent>
    </Card>
  )
}

function Destino({ forma, conta }: { forma: string; conta: string | undefined }) {
  return (
    <Typography component="div" variant="body2">
      <Typography component="dt" variant="body2" sx={{ display: 'inline', fontWeight: 500 }}>
        {forma}:
      </Typography>{' '}
      <Typography component="dd" variant="body2" sx={{ display: 'inline', m: 0 }}>
        {conta ?? 'não definida'}
      </Typography>
    </Typography>
  )
}
