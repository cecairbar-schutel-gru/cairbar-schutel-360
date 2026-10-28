import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Link as RouterLink } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

/**
 * Markdown dos arquivos de `src/content/` com componentes MUI. Links que começam com `/`
 * navegam dentro do site (ex.: `/docs/durvalcrm`); os demais abrem em nova aba.
 */
const componentes: Components = {
  h1: ({ children }) => (
    <Typography variant="h1" component="h2" sx={{ mt: 4, mb: 2 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="h2" component="h2" sx={{ mt: 5, mb: 2 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="h3" component="h3" sx={{ mt: 4, mb: 1.5 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="h4" component="h4" sx={{ mt: 3, mb: 1 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
      {children}
    </Typography>
  ),
  a: ({ href = '', children }) =>
    href.startsWith('/') ? (
      <Link component={RouterLink} to={href}>
        {children}
      </Link>
    ) : (
      <Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Link>
    ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { mb: 0.75, lineHeight: 1.7 } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 3, mb: 2, '& li': { mb: 0.75, lineHeight: 1.7 } }}>
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 4 }} />,
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        m: 0,
        mb: 2,
        px: 2,
        py: 1,
        borderLeft: 4,
        borderColor: 'primary.light',
        bgcolor: 'action.hover',
        borderRadius: 1,
        '& p': { mb: 0 },
      }}
    >
      {children}
    </Box>
  ),
  code: ({ className, children }) =>
    className ? (
      <Box component="code" sx={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
        {children}
      </Box>
    ) : (
      <Box
        component="code"
        sx={{
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: '0.875em',
          px: 0.5,
          py: 0.25,
          borderRadius: 1,
          bgcolor: 'action.hover',
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </Box>
    ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 1,
        overflowX: 'auto',
        bgcolor: 'secondary.main',
        color: 'secondary.contrastText',
        fontSize: '0.875rem',
        lineHeight: 1.6,
      }}
    >
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
      <Table size="small">{children}</Table>
    </TableContainer>
  ),
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => <TableCell sx={{ fontWeight: 700 }}>{children}</TableCell>,
  // Código não quebra no meio dentro de tabelas: no celular a tabela rola na horizontal.
  td: ({ children }) => (
    <TableCell sx={{ verticalAlign: 'top', '& code': { whiteSpace: 'nowrap', overflowWrap: 'normal' } }}>
      {children}
    </TableCell>
  ),
  img: ({ src, alt }) => (
    <Box component="img" src={src} alt={alt ?? ''} sx={{ maxWidth: '100%', borderRadius: 1 }} />
  ),
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
      {children}
    </ReactMarkdown>
  )
}
