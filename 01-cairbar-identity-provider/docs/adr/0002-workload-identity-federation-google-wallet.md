# ADR 0002 — Google Wallet por Workload Identity Federation, com o realm como provedor OIDC

- **Status:** aceito
- **Data:** 2026-10-22
- **Especificação:** seções 9 (carteirinha), 15 (segurança) e 24 (regras 1 e 6)

## Contexto

O Serviço de Carteirinha chama a Google Wallet API e assina o JWT do botão "Salvar no Google
Wallet" em nome de uma conta de serviço do Google Cloud. Até aqui isso exigia uma chave JSON
da conta: um segredo de longa duração, exportado do Google, guardado na máquina de quem roda
o Ansible e copiado para a VM. Se vazar, permite usar a conta até alguém revogar a chave.

O Keycloak já é um emissor OIDC público (`https://<host>/realms/cecairbar`, certificado
válido) e o Google Cloud aceita provedores OIDC externos em pools de Workload Identity
Federation.

## Decisão

- Um **pool por ambiente** no Google Cloud, com um provedor OIDC cujo issuer é o realm
  `cecairbar` daquele ambiente.
- Um **cliente dedicado no realm**, `servico-carteirinha-gcp` (Client Credentials, sem roles,
  `fullScopeAllowed: false`), com um audience mapper para a audience padrão do provedor. O
  provedor só aceita `azp == 'servico-carteirinha-gcp'` e usa `azp` como `google.subject`.
- O serviço troca o token do realm no STS do Google, **personifica a conta de serviço**
  (`generateAccessToken`) para a Wallet API e assina o JWT do botão com `signJwt` da IAM
  Credentials API. O principal do pool recebe só `roles/iam.serviceAccountTokenCreator`
  na conta de serviço.
- As chaves da conta de serviço são excluídas depois da migração.

## Alternativas consideradas

- **Manter a chave JSON** — mais simples, mas é exatamente o segredo de longa duração que
  se quer eliminar.
- **Reutilizar o cliente `servico-carteirinha`** — evitaria um segredo, mas o token dele
  carrega `manage-users` (Admin API) e seria enviado ao Google; um token vazado do STS
  valeria contra o Keycloak.
- **Credencial por arquivo/URL do gcloud (`create-cred-config`)** — o tipo URL só faz GET e
  o endpoint de token do Keycloak exige POST; o tipo arquivo exigiria um processo à parte
  renovando o token. O fornecedor de token em código (`subject_token_supplier`) evita os dois.

## Consequências

- Na VM fica só o segredo do cliente `servico-carteirinha-gcp`, que é do nosso realm, troca
  por `-e realm_carteirinha_gcp_atualizar_segredo=true` e, sozinho, só rende tokens de 5
  minutos aceitos por esse pool.
- A emissão passa a depender de STS e IAM Credentials (duas chamadas a mais, com cache de
  token pela biblioteca) e do JWKS do realm acessível pela internet.
- Tokens desse cliente não têm `person_id`: é M2M, não representa pessoa (seção 8.6 trata de
  tokens de usuário).

## Riscos

- Rotação de chaves do realm: o Google relê o JWKS, mas uma chave nova ativa antes de ser
  publicada pode falhar a troca por alguns minutos — rotacione com a chave nova passiva antes.
- `signJwt` usa chaves gerenciadas pelo Google; o Google Wallet valida o JWT pelas chaves
  públicas da conta. **Validar no ambiente dev** antes de excluir a chave antiga.
- TODO(seção 23): comportamento da emissão com o Keycloak fora do ar (já indefinido para a
  Admin API).
