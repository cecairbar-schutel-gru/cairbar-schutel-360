import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { Layout } from './components/Layout'
import { Documentacao } from './pages/Documentacao'
import { Inicio } from './pages/Inicio'
import { NaoEncontrada } from './pages/NaoEncontrada'
import { Novidades } from './pages/Novidades'
import { tema } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="docs" element={<Documentacao />} />
            <Route path="docs/:slug" element={<Documentacao />} />
            <Route path="novidades" element={<Novidades />} />
            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
)
