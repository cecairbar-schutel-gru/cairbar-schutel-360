import { Button, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../../../shared/api/http'
import { Aviso } from '../../../shared/components/Aviso'
import { LinhaAcoes, Pilha, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import { contribuicaoService } from '../services'

/** Acesso ao recibo pelo número, para reemissão ou cancelamento (Tesoureiro e Administrador). */
export function LocalizarReciboPage() {
  const navegar = useNavigate()
  const [numero, setNumero] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function localizar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    try {
      const { id } = await contribuicaoService.localizarPorRecibo(numero.trim())
      navegar(`/contribuicoes/${id}`)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Pilha component="section" aria-labelledby="titulo-localizar">
      <TituloPagina id="titulo-localizar">Recibos</TituloPagina>
      <TextoSuave>Informe o número do recibo para reemiti-lo (2ª via) ou cancelar a contribuição.</TextoSuave>
      <Pilha component="form" onSubmit={localizar} spacing={2} sx={{ maxWidth: '24rem' }}>
        <TextField
          label="Número do recibo"
          placeholder="2026-000123"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          required
        />
        {erro && <Aviso tipo="error" titulo="Erro">{erro}</Aviso>}
        <LinhaAcoes>
          <Button type="submit" variant="contained" disabled={!numero.trim()}>
            Localizar
          </Button>
        </LinhaAcoes>
      </Pilha>
    </Pilha>
  )
}
