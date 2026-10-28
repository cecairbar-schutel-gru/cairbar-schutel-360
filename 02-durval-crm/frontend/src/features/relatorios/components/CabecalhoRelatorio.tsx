import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { BotaoExportar, type FormatoArquivo } from '../../../shared/components/BotaoExportar'
import { LinkRota } from '../../../shared/components/LinkRota'
import { LinhaAcoes, TextoSuave, TituloPagina } from '../../../shared/components/layout'
import type { ArquivoBaixado } from '../../../shared/api/http'
import { BotaoImprimir, EstiloImpressao } from '../../editoras/components/Impressao'

/**
 * Cabeçalho dos relatórios no padrão do wireframe 12: título com o período à esquerda e
 * "Exportar" à direita; abaixo, os filtros. Na impressão ficam só o título e o conteúdo.
 */
export function CabecalhoRelatorio({ id, titulo, descricao, exportar, filtros, imprimir }: {
  id: string
  titulo: string
  descricao?: string
  exportar?: (formato: FormatoArquivo) => Promise<ArquivoBaixado>
  filtros?: ReactNode
  imprimir?: boolean
}) {
  return (
    <>
      <EstiloImpressao />
      <Box data-nao-imprimir>
        <LinkRota to="/relatorios">Voltar aos relatórios</LinkRota>
      </Box>
      <LinhaAcoes sx={{ justifyContent: 'space-between' }}>
        <TituloPagina id={id}>{titulo}</TituloPagina>
        <LinhaAcoes>
          {imprimir && <BotaoImprimir />}
          {exportar && <BotaoExportar exportar={exportar} />}
        </LinhaAcoes>
      </LinhaAcoes>
      {descricao && <TextoSuave>{descricao}</TextoSuave>}
      {filtros && (
        <Box component="section" aria-label="Filtros" data-nao-imprimir>
          {filtros}
        </Box>
      )}
    </>
  )
}
