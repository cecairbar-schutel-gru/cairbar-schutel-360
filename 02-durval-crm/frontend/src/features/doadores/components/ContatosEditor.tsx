import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import {
  Box,
  Button,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Radio,
  TextField,
} from '@mui/material'
import type { ReactNode } from 'react'
import { Fieldset, Legenda } from '../../../shared/components/layout'
import type { Email, Telefone, TipoTelefone } from '../types'

interface TelefonesProps {
  telefones: Telefone[]
  erro?: string
  onChange(telefones: Telefone[]): void
}

function garantirPrincipal<T extends { principal: boolean }>(lista: T[]): T[] {
  if (lista.length > 0 && !lista.some((i) => i.principal)) {
    return lista.map((i, idx) => ({ ...i, principal: idx === 0 }))
  }
  return lista
}

function LinhaContato({
  comTipo,
  children,
}: {
  comTipo: boolean
  children: ReactNode
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: comTipo
          ? 'minmax(8rem, 10rem) 1fr auto auto'
          : '1fr auto auto',
        gap: 2,
        alignItems: 'center',
      }}
    >
      {children}
    </Box>
  )
}

export function TelefonesEditor({ telefones, erro, onChange }: TelefonesProps) {
  const atualizar = (indice: number, parte: Partial<Telefone>) =>
    onChange(telefones.map((t, i) => (i === indice ? { ...t, ...parte } : t)))
  const definirPrincipal = (indice: number) =>
    onChange(telefones.map((t, i) => ({ ...t, principal: i === indice })))

  return (
    <Fieldset aria-describedby={erro ? 'erro-telefones' : undefined}>
      <Legenda>Telefones</Legenda>
      {telefones.map((t, i) => (
        <LinhaContato comTipo key={i}>
          <TextField
            id={`tel-tipo-${i}`}
            select
            label="Tipo"
            value={t.tipo}
            onChange={(e) =>
              atualizar(i, { tipo: e.target.value as TipoTelefone })
            }
            slotProps={{ select: { native: true } }}
          >
            <option value="CELULAR">Celular</option>
            <option value="FIXO">Fixo</option>
          </TextField>
          <TextField
            id={`tel-numero-${i}`}
            label="Número com DDD"
            value={t.numero}
            onChange={(e) => atualizar(i, { numero: e.target.value })}
            slotProps={{ htmlInput: { inputMode: 'tel' } }}
          />
          <FormControlLabel
            label="Principal"
            control={
              <Radio
                id={`tel-principal-${i}`}
                name="telefone-principal"
                checked={t.principal}
                onChange={() => definirPrincipal(i)}
              />
            }
          />
          <IconButton
            aria-label={`Remover telefone ${i + 1}`}
            onClick={() =>
              onChange(garantirPrincipal(telefones.filter((_, k) => k !== i)))
            }
          >
            <DeleteOutlinedIcon />
          </IconButton>
        </LinhaContato>
      ))}
      {erro && (
        <FormHelperText id="erro-telefones" error role="alert">
          {erro}
        </FormHelperText>
      )}
      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            onChange(
              garantirPrincipal([
                ...telefones,
                {
                  tipo: 'CELULAR',
                  numero: '',
                  principal: telefones.length === 0,
                },
              ]),
            )
          }
        >
          Adicionar telefone
        </Button>
      </Box>
    </Fieldset>
  )
}

interface EmailsProps {
  emails: Email[]
  erro?: string
  onChange(emails: Email[]): void
}

export function EmailsEditor({ emails, erro, onChange }: EmailsProps) {
  const atualizar = (indice: number, endereco: string) =>
    onChange(emails.map((e, i) => (i === indice ? { ...e, endereco } : e)))
  const definirPrincipal = (indice: number) =>
    onChange(emails.map((e, i) => ({ ...e, principal: i === indice })))

  return (
    <Fieldset aria-describedby={erro ? 'erro-emails' : undefined}>
      <Legenda>E-mails</Legenda>
      {emails.map((e, i) => (
        <LinhaContato comTipo={false} key={i}>
          <TextField
            id={`email-${i}`}
            label="Endereço de e-mail"
            type="email"
            value={e.endereco}
            onChange={(ev) => atualizar(i, ev.target.value)}
          />
          <FormControlLabel
            label="Principal"
            control={
              <Radio
                id={`email-principal-${i}`}
                name="email-principal"
                checked={e.principal}
                onChange={() => definirPrincipal(i)}
              />
            }
          />
          <IconButton
            aria-label={`Remover e-mail ${i + 1}`}
            onClick={() =>
              onChange(garantirPrincipal(emails.filter((_, k) => k !== i)))
            }
          >
            <DeleteOutlinedIcon />
          </IconButton>
        </LinhaContato>
      ))}
      {erro && (
        <FormHelperText id="erro-emails" error role="alert">
          {erro}
        </FormHelperText>
      )}
      <Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            onChange(
              garantirPrincipal([
                ...emails,
                { endereco: '', principal: emails.length === 0 },
              ]),
            )
          }
        >
          Adicionar e-mail
        </Button>
      </Box>
    </Fieldset>
  )
}
