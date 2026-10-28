import { Step, StepLabel, Stepper } from '@mui/material'

const PASSOS = [
  'Buscar doador',
  'Selecionar competências',
  'Pagamento',
  'Comprovante',
] as const

/** Jornada A em 4 passos (wireframes 5 a 8). */
export function PassosContribuicao({ ativo }: { ativo: number }) {
  return (
    <Stepper activeStep={ativo} alternativeLabel aria-label="Passos da contribuição">
      {PASSOS.map((p) => (
        <Step key={p}>
          <StepLabel>{p}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}
