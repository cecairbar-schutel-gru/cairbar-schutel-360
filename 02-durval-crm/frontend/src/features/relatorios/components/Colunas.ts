import { styled } from '@mui/material/styles'

/** Duas colunas lado a lado (receitas e despesas do wireframe 12); uma só em telas estreitas. */
export const Colunas = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(30rem, 100%), 1fr))',
  gap: theme.spacing(3),
  alignItems: 'start',
}))
