# Plataforma de Identidade Digital e Carteirinha da Organização

## 1. Visão geral

Este documento define os requisitos iniciais para o desenvolvimento de uma plataforma de identidade digital comum para uma organização sem fins lucrativos.

A solução deverá utilizar o **Keycloak** como serviço central de:

- identidade;
- cadastro e perfil da pessoa;
- autenticação;
- autorização baseada em papéis (RBAC);
- emissão de tokens para aplicações;
- gerenciamento do ciclo de vida do acesso.

Cada pessoa terá uma identidade única na organização e poderá possuir uma carteirinha digital com QR Code estático. A carteirinha poderá ser adicionada ao Apple Wallet e ao Google Wallet.

O QR Code será utilizado somente para identificar a pessoa. Empréstimos, compras, ingressos, doações, pagamentos e demais transações serão mantidos pelos respectivos sistemas de registro.

---

## 2. Objetivos do projeto

### 2.1 Objetivo principal

Criar uma identidade digital única que permita reconhecer uma pessoa de maneira consistente em todas as aplicações da organização.

### 2.2 Objetivos específicos

- Centralizar identidade, perfil, autenticação e autorização no Keycloak.
- Implementar Single Sign-On entre as aplicações web da organização.
- Permitir a administração de acessos por roles e grupos.
- Emitir uma carteirinha digital individual.
- Gerar QR Code estático associado a um identificador único.
- Disponibilizar a carteirinha no Apple Wallet e no Google Wallet.
- Permitir que os sistemas de negócio relacionem seus registros à mesma identidade.
- Manter dados transacionais fora do Keycloak.
- Registrar eventos administrativos e de segurança para auditoria.
- Adotar princípios de segurança por padrão, menor privilégio e minimização de dados.

---

## 3. Princípios arquiteturais

1. **Uma pessoa, uma identidade:** cada pessoa deve possuir um único registro principal no Keycloak.
2. **Keycloak como Identity/Profile Service:** dados básicos de identificação e relacionamento serão mantidos no perfil do usuário.
3. **Identificador comum:** todos os sistemas utilizarão o mesmo `personId` para referenciar a pessoa.
4. **QR Code identifica, mas não autoriza:** possuir ou apresentar o QR Code não concede acesso nem comprova permissão para uma transação.
5. **Sistemas de negócio são Systems of Record:** biblioteca, eventos, doações, vendas e voluntariado são responsáveis por seus próprios dados transacionais.
6. **RBAC para acesso funcional:** roles representam o que um operador pode fazer nas aplicações, e não seu histórico de relacionamento ou transações.
7. **Nenhum token de acesso no QR Code:** o código não deve armazenar access token, refresh token, senha, role ou dado financeiro.
8. **Privacidade por padrão:** dados pessoais exibidos, compartilhados e registrados devem ser limitados ao necessário.
9. **Baixo acoplamento:** novos sistemas devem integrar-se pelo identificador comum e por contratos de API estáveis.
10. **Auditabilidade:** operações administrativas e consultas sensíveis devem ser rastreáveis.

---

## 4. Escopo do MVP

### 4.1 Incluído

- Implantação e configuração do Keycloak.
- Definição do realm da organização.
- Configuração do User Profile.
- Cadastro, consulta, atualização, ativação e desativação de pessoas.
- Identificador único e imutável `personId`.
- Autenticação pelas aplicações usando OpenID Connect.
- Single Sign-On.
- Recuperação de credenciais.
- Verificação de e-mail, quando aplicável.
- RBAC por realm roles, client roles e grupos.
- Portal administrativo mínimo para gestão de identidades.
- Emissão, reemissão, suspensão e revogação da carteirinha.
- QR Code estático contendo apenas uma referência de identidade.
- Geração de passe para Apple Wallet.
- Geração de passe para Google Wallet.
- Aplicação web responsiva para leitura do QR Code.
- Integração inicial com o sistema de biblioteca.
- Logs de auditoria e eventos de segurança.

### 4.2 Fora do MVP

- Armazenar empréstimos no Keycloak.
- Armazenar doações ou instrumentos de pagamento no Keycloak.
- Armazenar compras, estoque ou tickets no Keycloak.
- QR Code dinâmico.
- NFC próprio.
- Biometria própria.
- Programa de pontos ou fidelidade.
- Operação totalmente offline.
- Carteira financeira.
- Credenciais verificáveis descentralizadas.
- Motor central de processos de negócio.

---

## 5. Atores

### 5.1 Pessoa cadastrada

Pessoa reconhecida pela organização. Pode ser voluntário, leitor da biblioteca, doador, participante de eventos, comprador ou possuir mais de um relacionamento simultaneamente.

### 5.2 Titular da carteirinha

Pessoa que recebeu uma carteirinha digital ativa.

### 5.3 Operador

Usuário autenticado que consulta uma identidade e executa operações em uma aplicação de negócio.

### 5.4 Administrador de identidade

Responsável pelo cadastro, correção, ativação, suspensão e vinculação de acessos.

### 5.5 Administrador de segurança

Responsável pelo realm, clientes, roles, grupos, políticas de autenticação e integrações do Keycloak.

### 5.6 Sistema de negócio

Aplicação que autentica usuários por meio do Keycloak e associa registros transacionais ao `personId`.

---

## 6. Contextos funcionais

### 6.1 Gestão de identidade

Responsável por:

- dados básicos da pessoa;
- credenciais;
- situação da identidade;
- autenticação;
- grupos;
- roles;
- consentimentos e preferências essenciais, caso incluídos no perfil;
- ciclo de vida da carteirinha.

### 6.2 Biblioteca

Responsável por:

- acervo;
- exemplares;
- empréstimos;
- devoluções;
- renovações;
- reservas;
- bloqueios;
- regras e limites da biblioteca.

### 6.3 Eventos

Responsável por:

- eventos;
- lotes e tipos de ingresso;
- pedidos;
- tickets;
- pagamentos;
- check-in;
- cancelamentos.

### 6.4 Doações

Responsável por:

- intenções de doação;
- contribuições;
- recorrência;
- conciliação;
- recibos;
- meios de pagamento;
- histórico financeiro.

### 6.5 Voluntariado

Responsável por:

- interesse em atividades;
- disponibilidade;
- escalas;
- presença;
- funções exercidas;
- histórico de participação.

---

## 7. Modelo de identidade no Keycloak

### 7.1 Realm

Nome lógico sugerido:

```text
organizacao
```

Ambientes separados:

```text
organizacao-dev
organizacao-hml
organizacao-prd
```

Não compartilhar banco, chaves, clientes confidenciais ou segredos entre ambientes.

### 7.2 Identificador principal

Utilizar um atributo de negócio chamado `personId`.

Formato sugerido:

```text
PER-00000001
```

Requisitos:

- único;
- imutável;
- gerado pelo sistema;
- não reutilizável;
- não derivado de CPF, telefone, e-mail ou nome;
- apto a ser referenciado pelos sistemas de negócio;
- não deve mudar quando username, e-mail ou relacionamento forem alterados.

O UUID interno do Keycloak poderá permanecer como identificador técnico. As aplicações deverão receber no token o `personId` como claim específico.

### 7.3 Atributos mínimos do User Profile

```yaml
personId:
  type: string
  required: true
  immutable: true
  unique: true

fullName:
  type: string
  required: true

preferredName:
  type: string
  required: false

email:
  type: email
  required: false

mobilePhone:
  type: string
  required: false

birthDate:
  type: date
  required: false

identityStatus:
  type: enum
  values:
    - ACTIVE
    - INACTIVE
    - SUSPENDED
  required: true

relationships:
  type: multivalued-enum
  values:
    - VOLUNTEER
    - LIBRARY_MEMBER
    - DONOR
    - EVENT_PARTICIPANT
    - CUSTOMER
  required: false

cardStatus:
  type: enum
  values:
    - NOT_ISSUED
    - ACTIVE
    - SUSPENDED
    - REVOKED
  required: true
```

> Observação de implementação: unicidade e imutabilidade de `personId` devem ser garantidas pela lógica de provisionamento e testadas explicitamente. Não presumir que somente a configuração visual do perfil será suficiente.

### 7.4 Dados que não devem ser mantidos no Keycloak

- empréstimos;
- reservas de livros;
- multas ou bloqueios da biblioteca;
- doações;
- dados bancários;
- dados de cartão;
- cobranças recorrentes;
- compras;
- estoque;
- tickets;
- check-ins;
- transações de caixa;
- escalas detalhadas;
- histórico operacional de cada domínio.

---

## 8. Autenticação e autorização

### 8.1 Protocolo

Usar OpenID Connect para aplicações web e APIs.

### 8.2 Fluxos

- Aplicações web com backend: Authorization Code Flow.
- Aplicações públicas: Authorization Code Flow com PKCE.
- Integrações máquina a máquina: Client Credentials com service accounts dedicadas.
- Não utilizar o QR Code como credencial de autenticação.
- Não usar Resource Owner Password Credentials.

### 8.3 Realm roles sugeridas

```text
platform-user
platform-admin
security-admin
identity-admin
```

### 8.4 Client roles sugeridas

```text
library.reader
library.operator
library.manager

events.operator
events.organizer

donations.operator
donations.treasurer
donations.admin

sales.seller
sales.manager

volunteering.operator
volunteering.manager
```

### 8.5 Grupos sugeridos

```text
/voluntarios
/voluntarios/biblioteca
/voluntarios/eventos
/voluntarios/vendas
/tesouraria
/administradores
```

As roles deverão ser preferencialmente atribuídas aos grupos. Atribuições diretas a usuários devem ser excepcionais e auditáveis.

### 8.6 Claims mínimas para aplicações

```json
{
  "sub": "<keycloak-user-id>",
  "person_id": "PER-00000001",
  "preferred_username": "usuario",
  "name": "Nome da Pessoa",
  "realm_access": {
    "roles": ["platform-user"]
  },
  "resource_access": {
    "library": {
      "roles": ["library.operator"]
    }
  }
}
```

Incluir nos tokens apenas os claims necessários a cada cliente.

---

## 9. Carteirinha digital

### 9.1 Objetivo

Representar visualmente a identidade da pessoa e fornecer um identificador de leitura rápida aos sistemas da organização.

### 9.2 Informações visíveis sugeridas

- nome da organização;
- nome preferencial da pessoa;
- número da carteirinha ou `personId` em formato legível;
- situação da carteirinha;
- identidade visual;
- QR Code;
- instrução para devolução ou contato em caso de uso indevido.

Foto deve ser opcional e depender de decisão de privacidade e necessidade operacional.

### 9.3 Conteúdo do QR Code

Formato inicial sugerido:

```text
org:person:PER-00000001
```

O conteúdo não deverá incluir:

- nome;
- CPF;
- telefone;
- e-mail;
- data de nascimento;
- roles;
- access token;
- refresh token;
- senha;
- dados financeiros;
- detalhes de empréstimos, eventos ou doações.

### 9.4 Propriedades do QR Code

- estático;
- individual;
- legível por câmera de celular;
- associado a uma identidade;
- sem poder de autorização;
- sem autenticação automática;
- sem dados transacionais;
- passível de invalidação operacional por meio do status da identidade ou da carteirinha.

### 9.5 Apple Wallet e Google Wallet

Criar um serviço de emissão de passes responsável por:

- produzir o passe apropriado para cada provedor;
- associar o passe ao `personId`;
- manter o identificador técnico retornado pelo provedor;
- atualizar campos visuais e status;
- revogar ou substituir uma emissão quando necessário;
- gerar links ou botões de adição à carteira;
- registrar eventos de emissão e atualização.

Esse serviço poderá ler dados de perfil do Keycloak por uma integração administrativa restrita, sem expor credenciais administrativas ao navegador.

---

## 10. Componentes da solução

```text
[Usuário/Titular]
       |
       v
[Portal / Aplicações Web]
       |
       +---------------------> [Keycloak]
       |                         - Identity/Profile
       |                         - Authentication
       |                         - RBAC
       |                         - Tokens
       |
       v
[API Gateway ou BFF]
       |
       +--> [Serviço de Carteirinha]
       |       - emissão
       |       - Apple Wallet
       |       - Google Wallet
       |       - status
       |       - auditoria
       |
       +--> [Biblioteca]
       |       - empréstimos
       |       - devoluções
       |       - reservas
       |
       +--> [Eventos]
       |       - tickets
       |       - check-in
       |
       +--> [Doações]
       |       - contribuições
       |       - recorrência
       |
       +--> [Voluntariado]
               - escalas
               - participação
```

### 10.1 Keycloak

System of Record para identidade, perfil e autorização.

### 10.2 Serviço de Carteirinha

System of Record para emissões técnicas dos passes e histórico do ciclo de vida da carteirinha, caso essas informações não sejam mantidas apenas como atributos mínimos no Keycloak.

### 10.3 Scanner Web

Aplicação responsiva utilizada pelos operadores para:

- solicitar acesso à câmera;
- ler QR Code;
- validar sintaxe;
- extrair `personId`;
- consultar o contexto necessário no sistema de negócio;
- não revelar dados além do permitido ao operador.

### 10.4 Aplicações de negócio

Cada aplicação deverá:

- autenticar operadores pelo Keycloak;
- validar issuer, audience, assinatura e expiração do token;
- verificar client roles;
- utilizar `person_id` como referência externa;
- manter seus próprios registros transacionais;
- impedir operações quando a regra de negócio não for satisfeita;
- registrar o operador responsável pela transação.

---

## 11. APIs iniciais

### 11.1 Serviço de carteirinha

```http
POST /api/v1/cards
GET  /api/v1/cards/{personId}
POST /api/v1/cards/{personId}/issue/apple
POST /api/v1/cards/{personId}/issue/google
POST /api/v1/cards/{personId}/suspend
POST /api/v1/cards/{personId}/reactivate
POST /api/v1/cards/{personId}/revoke
POST /api/v1/cards/{personId}/reissue
```

### 11.2 Resolução da identidade

Preferencialmente, o scanner autenticado deve enviar o valor lido ao backend do sistema de negócio:

```http
POST /api/v1/identity/resolve
Content-Type: application/json
Authorization: Bearer <operator-access-token>

{
  "qrValue": "org:person:PER-00000001"
}
```

Resposta mínima:

```json
{
  "personId": "PER-00000001",
  "displayName": "Nome Preferencial",
  "identityStatus": "ACTIVE",
  "cardStatus": "ACTIVE"
}
```

A API deve responder somente com atributos necessários ao contexto e permitidos para o cliente e operador.

### 11.3 Uso no sistema de biblioteca

```http
GET /api/v1/library-members/by-person/{personId}
GET /api/v1/loans?personId={personId}&status=OPEN
POST /api/v1/loans
POST /api/v1/loans/{loanId}/return
```

Exemplo de criação de empréstimo:

```json
{
  "personId": "PER-00000001",
  "copyId": "COPY-000145",
  "operatorId": "<obtido do token autenticado>"
}
```

---

## 12. Fluxos principais

### 12.1 Cadastro de pessoa

1. Administrador acessa a interface autenticada.
2. Sistema pesquisa duplicidade por critérios permitidos.
3. Administrador informa os dados mínimos.
4. Backend gera um `personId` único.
5. Backend cria o usuário e os atributos no Keycloak.
6. Se houver acesso às aplicações, o usuário recebe grupo e roles apropriados.
7. Sistema registra o evento de criação.
8. A carteirinha fica como `NOT_ISSUED` até sua emissão.

### 12.2 Emissão da carteirinha

1. Operador autorizado seleciona a pessoa.
2. Sistema valida `identityStatus = ACTIVE`.
3. Sistema verifica se existe emissão ativa.
4. Serviço cria ou atualiza o passe.
5. QR Code recebe `org:person:{personId}`.
6. Sistema apresenta os botões para Apple Wallet e Google Wallet.
7. Emissão é registrada na auditoria.

### 12.3 Empréstimo de livro

1. Bibliotecário autentica-se pelo Keycloak.
2. Aplicação verifica a role `library.operator`.
3. Bibliotecário escaneia a carteirinha.
4. Scanner obtém o `personId`.
5. Backend consulta a identidade e o cadastro da biblioteca.
6. Biblioteca consulta empréstimos, bloqueios e limites.
7. Bibliotecário seleciona ou escaneia o exemplar.
8. Biblioteca valida as regras de negócio.
9. Empréstimo é registrado no sistema da biblioteca.
10. Auditoria registra pessoa, operador, exemplar, data e resultado.

### 12.4 Compra de ingresso

1. O sistema identifica a pessoa pelo login ou QR Code.
2. O sistema de eventos consulta seus próprios dados.
3. A pessoa seleciona o evento e o tipo de ingresso.
4. O pagamento ocorre em provedor apropriado.
5. O sistema de eventos cria o ticket associado ao `personId`.
6. O ticket do evento é distinto da carteirinha institucional.

### 12.5 Adesão a doação recorrente

1. A pessoa é identificada pelo login ou `personId`.
2. O sistema de doações inicia a adesão.
3. Dados de pagamento são tratados pelo provedor de pagamentos.
4. O sistema de doações registra o vínculo de recorrência.
5. O Keycloak não armazena instrumento de pagamento nem histórico financeiro.

### 12.6 Suspensão ou desligamento

1. Administrador autorizado altera `identityStatus` ou `cardStatus`.
2. Sessões poderão ser encerradas quando necessário.
3. A carteirinha passa a ser rejeitada nos fluxos operacionais.
4. Sistemas de negócio preservam seus históricos.
5. O evento é registrado para auditoria.

---

## 13. Requisitos funcionais

### RF-001 — Cadastro único

A solução deve manter uma identidade principal por pessoa.

### RF-002 — Identificador comum

A solução deve gerar um `personId` único, imutável e não reutilizável.

### RF-003 — Perfil central

O Keycloak deve manter os atributos básicos definidos no User Profile.

### RF-004 — Autenticação centralizada

As aplicações devem delegar autenticação ao Keycloak.

### RF-005 — Autorização por roles

Cada aplicação deve permitir funções apenas a usuários com as client roles correspondentes.

### RF-006 — Carteirinha individual

A solução deve emitir uma carteirinha associada a uma única identidade.

### RF-007 — QR Code estático

A carteirinha deve conter QR Code estático com referência ao `personId`.

### RF-008 — Apple Wallet

A solução deve disponibilizar meio de adicionar a carteirinha ao Apple Wallet.

### RF-009 — Google Wallet

A solução deve disponibilizar meio de adicionar a carteirinha ao Google Wallet.

### RF-010 — Leitura por celular

O operador deve poder ler a carteirinha por uma aplicação web responsiva.

### RF-011 — Separação transacional

O Keycloak não deve armazenar dados transacionais dos domínios.

### RF-012 — Suspensão e revogação

Um administrador autorizado deve poder suspender, reativar, revogar e reemitir a carteirinha.

### RF-013 — Auditoria

A solução deve registrar operações administrativas e eventos relevantes de segurança.

### RF-014 — Integração

Sistemas de negócio devem receber ou resolver o `personId` por mecanismos autenticados.

### RF-015 — Busca de duplicidade

Antes de criar uma identidade, o sistema deve procurar possíveis registros existentes segundo regras configuráveis.

---

## 14. Requisitos não funcionais

### RNF-001 — Segurança

Todo tráfego externo e entre componentes deve utilizar TLS.

### RNF-002 — Menor privilégio

Usuários e service accounts devem receber somente as permissões necessárias.

### RNF-003 — Proteção de segredos

Segredos, chaves e credenciais não devem ser armazenados no código-fonte.

### RNF-004 — Privacidade

O sistema deve limitar coleta, exposição e retenção de dados pessoais.

### RNF-005 — Disponibilidade

A indisponibilidade do serviço de identidade não deve corromper os registros dos sistemas de negócio. Comportamentos de contingência devem ser definidos para cada processo.

### RNF-006 — Observabilidade

A solução deve produzir logs estruturados, métricas de saúde e identificadores de correlação.

### RNF-007 — Auditabilidade

Eventos devem registrar ator, ação, alvo, resultado, data e identificador de correlação, sem expor credenciais.

### RNF-008 — Portabilidade

Configurações do realm e infraestrutura devem ser versionadas e promovidas entre ambientes por automação.

### RNF-009 — Acessibilidade

Interfaces web devem atender boas práticas de acessibilidade, navegação por teclado e contraste.

### RNF-010 — Responsividade

O scanner e as telas operacionais devem funcionar em computador, tablet e celular.

### RNF-011 — Desempenho

A leitura do QR e a identificação da pessoa devem apresentar retorno adequado ao atendimento presencial. Medir antes de fixar metas definitivas.

### RNF-012 — Backup e recuperação

Devem existir rotinas testadas de backup e restauração do banco do Keycloak e das configurações relacionadas.

---

## 15. Segurança

### 15.1 Controles mínimos

- MFA obrigatório para administradores de identidade, segurança e tesouraria.
- PKCE para clientes públicos.
- Redirect URIs explícitas, sem curingas amplos.
- Validação de issuer e audience.
- Separação entre clientes públicos e confidenciais.
- Service account distinta por integração.
- Rotação de segredos.
- Rate limiting nos endpoints de resolução do QR.
- Proteção contra enumeração de `personId`.
- Proteção CSRF, XSS e injeção.
- Política de sessão por risco e função.
- Bloqueio e detecção de tentativas repetidas de autenticação.
- Não registrar tokens, senhas ou dados de pagamento em logs.
- Revisão periódica de roles e grupos.
- Princípio de dupla administração para alterações críticas, caso viável.

### 15.2 Ameaças a considerar

- fotografia ou cópia do QR Code;
- tentativa de usar o QR como prova de autorização;
- enumeração de identificadores;
- operador consultando pessoa sem necessidade;
- privilégios excessivos;
- identidade duplicada;
- conta não desativada após desligamento;
- vazamento de client secret;
- token aceito por audiência incorreta;
- exposição excessiva de atributos nos tokens;
- alteração indevida do `personId`;
- ambiente de homologação usando dados reais sem proteção.

### 15.3 Comportamento diante de QR copiado

Como o QR é um identificador estático, uma cópia pode reproduzir o mesmo valor. Portanto:

- o QR não deve autenticar o titular;
- transações de maior risco devem exigir confirmação adicional;
- o operador deve visualizar dados mínimos para conferência quando apropriado;
- sistemas devem respeitar os status da identidade e da carteirinha;
- atividades anômalas devem ser registradas e monitoradas;
- reemissão poderá manter o mesmo `personId`, mas deve permitir mudança do identificador técnico da emissão quando necessário.

---

## 16. Privacidade e LGPD

O desenvolvimento deve considerar:

- finalidade de cada atributo;
- base legal aplicável;
- minimização;
- transparência;
- controle de acesso;
- retenção;
- correção de dados;
- atendimento aos direitos do titular;
- registro de compartilhamentos;
- resposta a incidentes;
- descarte seguro;
- necessidade de Relatório de Impacto à Proteção de Dados Pessoais.

Decisões jurídicas devem ser validadas pela organização com apoio especializado. Este documento define requisitos técnicos e não substitui análise jurídica.

---

## 17. Persistência

### 17.1 Banco do Keycloak

Utilizar banco relacional suportado pela versão selecionada do Keycloak. Não acessar diretamente as tabelas internas a partir das aplicações de negócio.

### 17.2 Banco do serviço de carteirinha

Modelo inicial sugerido:

```yaml
DigitalCard:
  id: uuid
  personId: string
  status: NOT_ISSUED | ACTIVE | SUSPENDED | REVOKED
  version: integer
  issuedAt: datetime
  suspendedAt: datetime | null
  revokedAt: datetime | null
  createdBy: string
  updatedBy: string

WalletCredential:
  id: uuid
  digitalCardId: uuid
  provider: APPLE | GOOGLE
  providerObjectId: string
  status: ACTIVE | REVOKED | ERROR
  issuedAt: datetime
  lastUpdatedAt: datetime

AuditEvent:
  id: uuid
  actorId: string
  action: string
  targetType: string
  targetId: string
  result: SUCCESS | FAILURE
  correlationId: string
  occurredAt: datetime
  metadata: json
```

O serviço não deve duplicar todo o perfil do Keycloak. Poderá manter somente referências e dados técnicos necessários ao ciclo de vida do passe.

---

## 18. Histórias de usuário prioritárias

### US-001 — Cadastrar identidade

Como administrador de identidade, quero cadastrar uma pessoa com um identificador único para que ela seja reconhecida em todas as aplicações.

**Critérios de aceitação:**

- exige os campos obrigatórios;
- pesquisa possíveis duplicidades;
- gera `personId` automaticamente;
- não permite alterar `personId` após criação;
- registra auditoria.

### US-002 — Conceder função

Como administrador, quero associar uma pessoa a um grupo para conceder as permissões correspondentes.

**Critérios de aceitação:**

- apenas administrador autorizado pode alterar grupos;
- roles são herdadas do grupo;
- alteração é auditada;
- sessão e novo token refletem a alteração conforme política definida.

### US-003 — Emitir carteirinha

Como operador autorizado, quero emitir uma carteirinha para uma pessoa ativa para que ela possa ser identificada presencialmente.

**Critérios de aceitação:**

- pessoa deve estar ativa;
- QR contém somente a referência definida;
- carteira pode ser adicionada aos provedores suportados;
- emissão é auditada;
- emissão duplicada é impedida ou tratada explicitamente.

### US-004 — Escanear na biblioteca

Como bibliotecário, quero escanear a carteirinha para localizar rapidamente o leitor.

**Critérios de aceitação:**

- bibliotecário precisa estar autenticado;
- precisa possuir `library.operator`;
- QR inválido é rejeitado;
- identidade suspensa é sinalizada;
- somente dados necessários são exibidos;
- empréstimo permanece registrado no sistema da biblioteca.

### US-005 — Suspender identidade

Como administrador de identidade, quero suspender uma identidade para impedir novos acessos e usos operacionais.

**Critérios de aceitação:**

- operação exige permissão apropriada;
- motivo é registrado;
- novas autenticações são impedidas;
- status é considerado pela resolução da carteirinha;
- históricos transacionais são preservados.

### US-006 — Reemitir carteirinha

Como operador autorizado, quero reemitir uma carteirinha para corrigir ou substituir uma emissão anterior.

**Critérios de aceitação:**

- preserva `personId`;
- versiona ou revoga a emissão anterior;
- atualiza o passe nos provedores quando suportado;
- registra o motivo e o ator.

---

## 19. Critérios de aceite do MVP

O MVP será considerado funcional quando:

1. Uma pessoa puder ser cadastrada uma única vez.
2. O `personId` for gerado, persistido e enviado como claim às aplicações autorizadas.
3. Um administrador puder atribuir grupos e roles.
4. Um operador puder autenticar-se por meio do Keycloak.
5. Uma carteirinha puder ser emitida com QR Code estático.
6. A carteirinha puder ser adicionada aos provedores de wallet definidos.
7. O scanner web puder ler o QR em um celular.
8. O sistema puder resolver o QR para uma identidade ativa.
9. A biblioteca puder associar um empréstimo ao `personId`.
10. O Keycloak não armazenar o empréstimo.
11. Uma identidade suspensa ou carteirinha revogada for rejeitada no fluxo operacional.
12. Eventos administrativos relevantes forem auditados.
13. Nenhum token, senha ou dado financeiro aparecer no QR ou nos logs.
14. Testes automatizados cobrirem os fluxos críticos.

---

## 20. Estratégia de testes

### 20.1 Testes unitários

- geração e validação de `personId`;
- parser do QR Code;
- regras de estado da carteirinha;
- mapeamento de claims;
- políticas de autorização da aplicação.

### 20.2 Testes de integração

- criação e atualização de usuário no Keycloak;
- login OIDC;
- renovação e expiração de sessão;
- obtenção de roles;
- emissão de passes;
- resolução do QR;
- integração com biblioteca.

### 20.3 Testes de segurança

- acesso sem token;
- token expirado;
- token com issuer incorreto;
- token com audience incorreta;
- usuário sem role;
- tentativa de alterar `personId`;
- enumeração de IDs;
- QR malformado;
- injeção em campos de perfil;
- exposição indevida de PII;
- replay do QR em processos de maior risco.

### 20.4 Testes de experiência

- leitura em Android e iPhone;
- leitura com iluminação reduzida;
- QR exibido em tela e impresso;
- navegador móvel;
- mensagens para identidade suspensa;
- fluxo de perda e reemissão.

---

## 21. Estratégia de implementação

### Fase 1 — Fundação de identidade

- preparar ambientes;
- instalar Keycloak e banco;
- configurar realm;
- definir User Profile;
- implementar geração de `personId`;
- configurar clientes OIDC;
- configurar roles e grupos;
- habilitar auditoria básica.

### Fase 2 — Gestão de identidade

- criar interface administrativa mínima;
- implementar busca de duplicidade;
- implementar ativação, suspensão e reativação;
- implementar atribuição de grupos;
- validar ciclo de vida de sessão.

### Fase 3 — Carteirinha

- criar serviço de carteirinha;
- gerar QR Code;
- implementar Apple Wallet;
- implementar Google Wallet;
- registrar emissão e revogação;
- criar scanner web.

### Fase 4 — Biblioteca

- integrar autenticação;
- mapear roles;
- usar `personId`;
- implementar resolução do QR;
- associar empréstimos à identidade;
- executar testes ponta a ponta.

### Fase 5 — Expansão

- integrar eventos;
- integrar doações;
- integrar voluntariado;
- criar portal unificado da pessoa;
- evoluir observabilidade, segurança e governança.

---

## 22. Backlog técnico inicial

### Épico A — Plataforma Keycloak

- provisionar ambientes;
- configurar banco;
- configurar proxy e TLS;
- configurar realm;
- versionar configuração;
- configurar SMTP;
- configurar temas, se necessário;
- configurar eventos e auditoria;
- configurar backup e restauração.

### Épico B — Perfil e identidade

- definir atributos;
- gerar `personId`;
- validar unicidade;
- criar busca administrativa;
- detectar possíveis duplicidades;
- definir estados da identidade;
- administrar relacionamentos.

### Épico C — Autorização

- definir realm roles;
- definir client roles;
- definir grupos;
- mapear roles nos tokens;
- criar testes de autorização;
- revisar privilégios administrativos.

### Épico D — Carteirinha

- criar modelo de dados;
- gerar representação visual;
- gerar QR;
- emitir passe Apple;
- emitir passe Google;
- suspender e revogar;
- reemitir;
- auditar.

### Épico E — Scanner

- acessar câmera;
- ler QR;
- validar namespace e formato;
- chamar backend autenticado;
- exibir resultado mínimo;
- tratar erros;
- registrar eventos necessários.

### Épico F — Biblioteca

- configurar cliente OIDC;
- mapear `person_id`;
- integrar scanner;
- localizar leitor;
- registrar empréstimo;
- validar estado da identidade;
- auditar operador.

---

## 23. Decisões em aberto

As seguintes decisões devem ser resolvidas antes ou durante a implementação:

1. O identificador será `personId`, `memberId` ou outro nome?
2. Toda pessoa cadastrada terá credencial de login ou somente quem acessar aplicações?
3. Quais atributos serão obrigatórios para cada tipo de relacionamento?
4. Quem pode criar e corrigir identidades?
5. Quem pode emitir, suspender e reemitir carteirinhas?
6. A carteirinha exibirá foto?
7. O status da carteirinha ficará somente no Keycloak ou também no serviço de emissão?
8. Qual será o comportamento de contingência quando o Keycloak estiver indisponível?
9. Quais operações exigirão confirmação adicional além do QR?
10. Qual provedor processará pagamentos e recorrência?
11. Quais dados poderão aparecer para cada tipo de operador?
12. Qual será a política de retenção e exclusão?
13. Será necessária migração de cadastros existentes?
14. Como serão tratados registros históricos sem identificação suficiente?
15. Qual será a identidade visual final da carteirinha?

---

## 24. Instruções para o agente de desenvolvimento

Ao gerar a solução:

1. Preserve a separação entre identidade e dados transacionais.
2. Trate o Keycloak como System of Record para Identity/Profile e autorização.
3. Não crie uma base paralela com cópia integral do perfil.
4. Use `personId` como chave de integração externa.
5. Nunca grave access token, refresh token, senha ou dados financeiros no QR.
6. Não interprete a leitura do QR como autenticação do titular.
7. Valide token e role no backend, não somente na interface.
8. Mantenha configurações por ambiente.
9. Use migrações de banco versionadas.
10. Produza APIs documentadas com OpenAPI.
11. Crie testes automatizados para os critérios de aceite.
12. Use logs estruturados e correlation ID.
13. Não registre dados sensíveis desnecessários.
14. Documente variáveis de ambiente e segredos necessários.
15. Entregue scripts de execução local e implantação.
16. Não assuma funcionalidades específicas do Keycloak sem validá-las na versão selecionada.
17. Marque decisões ainda não tomadas como `TODO`, sem inventar requisitos.

---

## 25. Entregáveis esperados

- código-fonte;
- documentação de arquitetura;
- modelo de dados;
- especificação OpenAPI;
- configuração versionada do Keycloak;
- scripts de infraestrutura e implantação;
- serviço de carteirinha;
- scanner web responsivo;
- integração de referência com biblioteca;
- testes automatizados;
- guia de operação;
- guia de backup e restauração;
- matriz de roles e permissões;
- registro das decisões arquiteturais relevantes.

---

## 26. Resumo executivo da arquitetura

```text
Keycloak
  ├── identidade
  ├── perfil
  ├── autenticação
  ├── roles e grupos
  └── claim person_id

Carteirinha
  ├── representação da identidade
  ├── QR estático
  ├── Apple Wallet
  └── Google Wallet

Sistemas de negócio
  ├── usam personId
  ├── mantêm transações próprias
  ├── aplicam regras próprias
  └── registram o operador autenticado
```

A solução deve permitir que uma mesma pessoa seja reconhecida de forma consistente em todo o ecossistema, sem transformar o Keycloak em repositório de empréstimos, compras, tickets, doações ou outras transações.

O princípio fundamental é:

> **O Keycloak determina quem é a pessoa e o que um operador pode acessar. A carteirinha fornece uma referência de identidade. Cada sistema de negócio determina e registra o que pode ser realizado em seu domínio.**
