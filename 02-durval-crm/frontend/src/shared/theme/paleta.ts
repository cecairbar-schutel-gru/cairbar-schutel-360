// Paleta da identidade visual compartilhada com a Comunidade Cairbar
// (01-cairbar-identity-provider/theme/src/shared/theme.ts), derivada do logotipo.
// `faixa` é o azul das faixas do logotipo: só decorativo (≈ 2:1 sobre branco).
// Texto, botões e links usam `primaria`, a mesma matiz escurecida: 6,0:1 sobre
// branco e 5,6:1 sobre o fundo (WCAG AA), com texto branco sobre ela.
// Só o tema (`tema.ts`) e o shell leem estes valores; componentes usam `theme.palette.*`.

export const paleta = {
  faixa: '#7DC1E7',
  primaria: '#2C698B',
  primariaEscura: '#1B4055',
  grafite: '#111111',
  textoSecundario: '#4A5560',
  fundo: '#F4F7FA',
  superficie: '#FFFFFF',
  divisor: 'rgba(17, 17, 17, 0.12)',
  sucesso: '#2E7D32',
  alerta: '#8A5300',
  erro: '#C62828',
} as const
