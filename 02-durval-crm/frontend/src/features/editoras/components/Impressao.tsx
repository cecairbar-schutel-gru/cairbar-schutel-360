import PrintIcon from '@mui/icons-material/Print'
import { Box, Button, GlobalStyles, Typography } from '@mui/material'
import { formatarCnpj } from '../regras'
import type { Organizacao } from '../types'

/** Na impressão some o shell e tudo o que estiver marcado com `data-nao-imprimir`. */
export function EstiloImpressao() {
  return (
    <GlobalStyles
      styles={{
        '@media print': {
          'header, nav, .MuiDrawer-root, [data-nao-imprimir]': { display: 'none !important' },
          main: { padding: '0 !important' },
        },
      }}
    />
  )
}

export function BotaoImprimir() {
  return (
    <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => window.print()} data-nao-imprimir>
      Imprimir
    </Button>
  )
}

/** Identificação da organização e da editora no topo dos documentos impressos. */
export function CabecalhoDocumento({
  organizacao,
  titulo,
  editoraNome,
  editoraCnpj,
}: {
  organizacao: Organizacao
  titulo: string
  editoraNome: string
  editoraCnpj: string | null
}) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" component="p">
        {organizacao.nome}
        {organizacao.cnpj && ` · CNPJ ${formatarCnpj(organizacao.cnpj)}`}
        {organizacao.endereco && ` · ${organizacao.endereco}`}
      </Typography>
      <Typography variant="h5" component="h2">
        {titulo}
      </Typography>
      <Typography>
        Editora: <strong>{editoraNome}</strong>
        {editoraCnpj && ` · CNPJ ${formatarCnpj(editoraCnpj)}`}
      </Typography>
    </Box>
  )
}

/** Linhas de assinatura dos dois lados (comprovante de devolução). */
export function Assinaturas({ esquerda, direita }: { esquerda: string; direita: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, pt: 6 }}>
      {[esquerda, direita].map((rotulo) => (
        <Box key={rotulo} sx={{ borderTop: 1, borderColor: 'text.primary', pt: 1, textAlign: 'center' }}>
          <Typography variant="body2">{rotulo}</Typography>
        </Box>
      ))}
    </Box>
  )
}
