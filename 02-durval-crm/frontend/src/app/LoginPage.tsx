import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authService, ROTULO_PAPEL } from '../auth'
import { useAuth } from '../auth/AuthProvider'
import { Aviso } from '../shared/components/Aviso'
import { Pilha, TextoSuave } from '../shared/components/layout'
import logo from '../shared/assets/logo.png'

export function LoginPage() {
  const { usuario } = useAuth()
  const local = useLocation()
  const destino = (local.state as { de?: string } | null)?.de ?? '/'

  if (usuario && usuario.papeis.length > 0)
    return <Navigate to={destino} replace />

  return (
    <Box
      component="main"
      sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 3 }}
    >
      <Card variant="outlined" sx={{ width: 'min(28rem, 100%)' }}>
        <CardContent sx={{ textAlign: 'center' }}>
          {authService.modo === 'simulado' ? (
            <EntradaSimulada destino={destino} />
          ) : usuario ? (
            <SemPapel />
          ) : (
            <EntradaKeycloak destino={destino} />
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

function Cabecalho() {
  return (
    <>
      <Box
        component="img"
        src={logo}
        alt="CE Cairbar Schutel"
        sx={{ width: '100%', maxWidth: 280, alignSelf: 'center' }}
      />
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          component="img"
          src="/logo-durvalcrm-avatar.png"
          alt=""
          sx={{ width: 72, height: 72 }}
        />
        <Typography variant="h5" component="h1">
          DurvalCRM
        </Typography>
      </Stack>
    </>
  )
}

function EntradaKeycloak({ destino }: { destino: string }) {
  const [redirecionando, setRedirecionando] = useState(false)
  return (
    <Pilha>
      <Cabecalho />
      <TextoSuave>Entre com a sua conta da Comunidade Cairbar.</TextoSuave>
      <Button
        variant="contained"
        disabled={redirecionando}
        onClick={() => {
          setRedirecionando(true)
          void authService.redirecionarParaLogin(destino)
        }}
      >
        Entrar
      </Button>
    </Pilha>
  )
}

/** Conta válida no realm, mas sem nenhum papel do DurvalCRM. */
function SemPapel() {
  const { usuario, sair } = useAuth()
  return (
    <Pilha>
      <Cabecalho />
      <Aviso tipo="warning" titulo="Sem acesso ao DurvalCRM">
        {`${usuario?.nome}, sua conta ainda não tem um perfil no DurvalCRM. Peça a um administrador para liberar o acesso.`}
      </Aviso>
      <Button variant="outlined" onClick={sair}>
        Sair
      </Button>
    </Pilha>
  )
}

function EntradaSimulada({ destino }: { destino: string }) {
  const { entrar } = useAuth()
  const navegar = useNavigate()
  const usuarios = authService.usuariosDisponiveis()
  const [selecionado, setSelecionado] = useState(usuarios[0].id)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    entrar(selecionado)
    navegar(destino, { replace: true })
  }

  return (
    <Pilha component="form" onSubmit={enviar}>
      <Cabecalho />
      <TextoSuave>
        Autenticação simulada. Em produção o acesso é feito pelo Keycloak.
      </TextoSuave>
      <TextField
        id="usuario-simulado"
        select
        label="Usuário"
        value={selecionado}
        onChange={(e) => setSelecionado(e.target.value)}
        slotProps={{ select: { native: true } }}
      >
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {`${u.nome} (${u.papeis.map((p) => ROTULO_PAPEL[p]).join(', ')})`}
          </option>
        ))}
      </TextField>
      <Button type="submit" variant="contained">
        Entrar
      </Button>
    </Pilha>
  )
}
