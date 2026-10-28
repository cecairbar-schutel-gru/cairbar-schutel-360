/** Nome usado nas mensagens enquanto os dados da organização (US-ADMIN-005) não carregam. */
export const NOME_ORGANIZACAO = 'nossa organização'

export const MODELO_ANIVERSARIO_PADRAO = {
  whatsapp:
    'Olá, {nome}! Feliz aniversário! Um abraço de todos da {organizacao}.',
  emailAssunto: 'Feliz aniversário, {nome}!',
  emailCorpo:
    'Olá, {nome}!\n\nFeliz aniversário! Um abraço de todos da {organizacao}.',
}

/** Textos da instalação (iguais aos da migração V10), usados enquanto os modelos configurados (US-ADMIN-003) não carregam. */
export const MODELO_AGRADECIMENTO_PADRAO = {
  whatsapp:
    'Olá, {nome}! Recebemos sua contribuição de {valor} em {data} ({competencias}). Recibo nº {recibo}. Muito obrigado! {organizacao}',
  emailAssunto: 'Recibo nº {recibo} — obrigado pela sua contribuição',
  emailCorpo:
    'Olá, {nome}!\n\nRecebemos sua contribuição de {valor} em {data} ({competencias}).\nRecibo nº {recibo} (em anexo).\n\nMuito obrigado!\n{organizacao}',
}
