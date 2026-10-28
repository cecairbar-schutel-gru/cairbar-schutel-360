import { MenuItem, TextField } from '@mui/material'
import { useState } from 'react'
import { categoriasMae, subcategorias } from '../regras'
import type { Categoria, TipoCategoria } from '../types'

interface Props {
  categorias: Categoria[]
  tipo: TipoCategoria
  /** Subcategorias oferecidas (ex.: só as permitidas no lançamento manual). */
  filtro(c: Categoria): boolean
  /** Código da subcategoria escolhida ('' se nenhuma). */
  valor: string
  onAlterar(codigo: string): void
  erro?: string
  desabilitado?: boolean
}

/** Plano de contas com um nível: a categoria filtra as subcategorias (Spec §5). */
export function SeletorCategoria({ categorias, tipo, filtro, valor, onAlterar, erro, desabilitado }: Props) {
  const [mae, setMae] = useState(() => categorias.find((c) => c.codigo === valor)?.categoriaPai ?? '')
  const maes = categoriasMae(categorias, tipo, filtro)
  const maeValida = maes.some((m) => m.codigo === mae) ? mae : ''
  const subs = maeValida ? subcategorias(categorias, maeValida, filtro) : []
  return (
    <>
      <TextField
        select
        label="Categoria"
        required
        value={maeValida}
        onChange={(e) => {
          setMae(e.target.value)
          const opcoes = subcategorias(categorias, e.target.value, filtro)
          onAlterar(opcoes.length === 1 ? opcoes[0].codigo : '')
        }}
        disabled={desabilitado}
      >
        {maes.map((m) => (
          <MenuItem key={m.codigo} value={m.codigo}>
            {m.nome}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Subcategoria"
        required
        value={subs.some((s) => s.codigo === valor) ? valor : ''}
        onChange={(e) => onAlterar(e.target.value)}
        error={!!erro}
        helperText={erro ?? (maeValida ? ' ' : 'Escolha a categoria primeiro.')}
        disabled={desabilitado || !maeValida}
      >
        {subs.map((s) => (
          <MenuItem key={s.codigo} value={s.codigo}>
            {s.nome}
          </MenuItem>
        ))}
      </TextField>
    </>
  )
}
