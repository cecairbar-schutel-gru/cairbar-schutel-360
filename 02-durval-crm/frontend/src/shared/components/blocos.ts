import { styled } from '@mui/material/styles'

/** Grade responsiva de campos de formulário. */
export const GradeForm = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(16rem, 100%), 1fr))',
  gap: theme.spacing(2),
}))

/** Linha de botões e ações, com quebra automática. */
export const LinhaAcoes = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  alignItems: 'center',
}))

/** Agrupamento de campos sem a borda padrão do navegador. */
export const Fieldset = styled('fieldset')(({ theme }) => ({
  border: 0,
  margin: 0,
  padding: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}))
