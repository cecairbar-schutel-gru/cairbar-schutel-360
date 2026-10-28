import { Box, Button, Typography } from '@mui/material'
import { Aviso } from '../../../shared/components/Aviso'
import { Carregando } from '../../../shared/components/Carregando'
import { Pilha, TextoSuave } from '../../../shared/components/layout'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { useCarregamento } from '../../../shared/hooks/useCarregamento'
import { vendaService } from '../services'
import type { ProdutoVendavel } from '../types'

/** Produtos da cantina em botões grandes por categoria, para telas de toque (US-SALES-002). */
export function BotoesCantina({ onAdicionar }: { onAdicionar(produto: ProdutoVendavel): void }) {
  const { dados, carregando, erro } = useCarregamento(() => vendaService.buscarProdutos('', 'CANTINA'), [])
  if (carregando) return <Carregando />
  if (erro || !dados) return <Aviso tipo="error" titulo="Erro">{erro ?? 'Não foi possível carregar a cantina.'}</Aviso>
  if (dados.length === 0) return <TextoSuave>Nenhum produto da cantina ativo.</TextoSuave>

  const categorias = [...new Set(dados.map((p) => p.categoria ?? 'Outros'))]
  return (
    <Pilha spacing={2}>
      {categorias.map((categoria) => (
        <Box key={categoria} component="section" aria-label={categoria}>
          <Typography variant="subtitle2" component="h3" color="text.secondary" sx={{ mb: 1 }}>
            {categoria}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))', gap: 1 }}>
            {dados
              .filter((p) => (p.categoria ?? 'Outros') === categoria)
              .map((p) => (
                <Button
                  key={p.id}
                  variant="outlined"
                  disabled={p.disponivel <= 0}
                  onClick={() => onAdicionar(p)}
                  aria-label={`Adicionar ${p.nome}`}
                  sx={{ minHeight: '4.5rem', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {p.nome}
                  </Box>
                  <Box component="span">{formatarMoeda(p.preco)}</Box>
                  <Box component="span" sx={{ typography: 'caption' }}>
                    {p.disponivel <= 0 ? 'Sem estoque' : `${p.disponivel} disponíveis`}
                  </Box>
                </Button>
              ))}
          </Box>
        </Box>
      ))}
    </Pilha>
  )
}
