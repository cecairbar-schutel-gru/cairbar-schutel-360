# Stack Tecnológica e Arquitetura - DurvalCRM

Arquitetura de referência para o DurvalCRM, integrando um **Frontend SPA em React + Vite com Material Design (MUI)** orientado ao wireframe de referência [`Designer.png`](Designer.png), um **Backend em Spring Boot** aplicando **Clean Architecture**, **DDD tático** e **Monólito Modular**, e o **Keycloak** como provedor de identidade (OAuth 2.0 / OpenID Connect).

---

## 1. Visão Geral da Arquitetura

```
                         ┌─────────────────────────────────────────┐
                         │           Keycloak (OIDC)               │
                         │                                         │
                         │  • Login / SSO          • Roles         │
                         │  • Usuários / Grupos    • Emissão JWT   │
                         └────────────────────┬────────────────────┘
                                              │
                         1. Autenticação      │ 2. JWT Access Token
                         ┌────────────────────┴────────────────────┐
                         ▼                                         │
       ┌───────────────────────────────────┐                       │
       │   Frontend SPA (Vite + React)     │                       │
       │                                   │                       │
       │   • Material Design (MUI v5/v6)   │                       │
       │   • Telas 1–12 (Designer.png)     │                       │
       │   • React Router + Context / Auth │                       │
       └─────────────────┬─────────────────┘                       │
                         │                                         │
                         │ 3. REST API + Bearer Token              │
                         ▼                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DurvalCRM - Spring Boot                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Frameworks & Drivers                         │  │
│  │                                                                  │  │
│  │ Spring Security (OAuth2 RS)   Tomcat Embedded    PostgreSQL      │  │
│  │ Hibernate / Spring Data JPA   Flyway             ArchUnit        │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │                     Interface Adapters                           │  │
│  │                                                                  │  │
│  │ REST Controllers (Doador, Venda...)  Persistence Adapters (JPA)  │  │
│  │ Security Adapters (Keycloak Jwt)     DTOs / Mappers / Responses  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │                        Application                               │  │
│  │                                                                  │  │
│  │ RegistrarContribuicaoUseCase         RealizarVendaUseCase        │  │
│  │ SolicitarIntencaoGastoUseCase        CurrentUserPort / Output    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │                          Domain                                  │  │
│  │                                                                  │  │
│  │ Doador      Contribuicao   Venda       ItemEstoque               │  │
│  │ Intencao    Lancamento     Regras de Negócio                     │  │
│  │                                                                  │  │
│  │                      JAVA PURO (Sem frameworks)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend: React + Vite + Material Design (MUI)

O frontend é uma Single Page Application (SPA) moderna, rápida e tipada, desenvolvida com **Vite**, **React** e **TypeScript**, utilizando a biblioteca oficial do **Material Design para React (MUI - `@mui/material`)** na versão **Material UI v9.5.0**, edição open source (licença MIT). Componentes das linhas pagas (MUI X Pro/Premium) não devem ser usados.

O esquema de cores da interface deve remeter ao logotipo da organização, disponível em [`ce_cairbar_logo.png`](ce_cairbar_logo.png) (ver §2.3).

### 2.1 Stack Frontend

| Tecnologia | Finalidade |
|---|---|
| **Vite** | Build tool e dev server ultrarrápido com HMR nativo |
| **React 18+ (ou 19)** | Biblioteca declarativa de interfaces baseada em componentes |
| **TypeScript** | Tipagem estática e contratos seguros com a API |
| **Material UI v9.5.0 (`@mui/material@9.5.0`, open source)** | Sistema de design e componentes Material Design (Cards, Grids, Steppers, Modals, Tables) |
| **MUI Icons (`@mui/icons-material`)** | Ícones padrão Material Symbols / Icons para ações e navegação |
| **Emotion (`@emotion/react`, `@emotion/styled`)** | Mecanismo de estilização do MUI com suporte a tema customizado |
| **React Router** | Roteamento client-side com rotas protegidas por papel (`RequireRole`) |
| **Recharts / MUI X Charts (versão gratuita)** | Gráficos e dashboards financeiros / operacionais |
| **MSW (Mock Service Worker)** | Simulação de API e dados mockados em desenvolvimento antes do backend |
| **Vitest + React Testing Library** | Testes unitários e de componentes |

### 2.2 Orientação Visual: Wireframe [`Designer.png`](Designer.png)

A construção visual, disposição dos elementos, navegação e hierarquia de componentes seguem rigorosamente as 12 telas especificadas no wireframe de referência [`Designer.png`](Designer.png):

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE TELAS DO WIREFRAME Designer.png                          │
├────────────────────────────┬────────────────────────────┬───────────────────────────────┤
│ 1. Painel - Operador       │ 2. Painel - Vendedor       │ 3. Painel - Tesoureiro        │
│ • Ações rápidas (cards)    │ • Ações rápidas (cards)    │ • Visão Financeira do Mês     │
│ • Aniversariantes do mês   │ • Produtos em baixo estoque│ • Pendências e conciliações   │
├────────────────────────────┼────────────────────────────┼───────────────────────────────┤
│ 4. Painel - Administrador  │ 5. Registrar Contribuição  │ 6. Competências e Pagamento   │
│ • Visão geral (métricas)   │ • Passo 1: Buscar doador   │ • Passo 2: Seleção de meses e │
│ • Atalhos e Receitas x Desp│ • Lista e busca rápida     │   doações extraordinárias     │
├────────────────────────────┼────────────────────────────┼───────────────────────────────┤
│ 7. Formas de Pagamento     │ 8. Comprovante e Sucesso   │ 9. Nova Venda (Cantina/Livros)│
│ • Passo 3: Dinheiro/PIX/Car│ • Passo 4: Resumo e ações  │ • Seleção de itens e quant.   │
│ • Validação de totais      │ • Envio WhatsApp/E-mail    │ • Pagamento e totalização     │
├────────────────────────────┼────────────────────────────┼───────────────────────────────┤
│ 10. Estoque - Produtos     │ 11. Intenção de Gasto      │ 12. Relatórios / Prestação    │
│ • Cantina vs Consignados   │ • Formulário de solicitação│ • Prestação de contas mensal  │
│ • Saldo, entrada e ações   │ • Categoria/Sub e Anexos   │ • Receitas/Despesas por cat.  │
└────────────────────────────┴────────────────────────────┴───────────────────────────────┘
```

#### Diretrizes de Implementação com Material Design (MUI):
1. **Estrutura e Layout (Shell):**
   - Barra lateral fixa (`Drawer` permanente ou retrátil) contendo o logotipo, links de navegação por perfil e botão de logout.
   - Cabeçalho superior (`AppBar` / `Toolbar`) com identificação do usuário ativo, seletor de papel ativo e notificações.
   - Container principal (`Container` / `Box`) com fundo limpo (`#f8fafc` ou `#f5f5f5`), aplicando espaçamentos estruturados do MUI `theme.spacing()`.

2. **Cards e Métricas:**
   - Métricas em destaque nos painéis (Receitas, Despesas, Pendências, Doadores ativos) com `Card`, `CardContent`, `Typography` variante `h4`/`subtitle2` e badges de status.

3. **Jornada de Contribuição (Wizard em 4 Passos):**
   - Utilização do `Stepper` e `Step` do MUI com 4 etapas:
     1. *Buscar doador*
     2. *Selecionar competências*
     3. *Formas de pagamento*
     4. *Comprovante*
   - Validações em tempo real e totalizadores claros.

4. **Tabelas e Listas de Dados:**
   - `Table`, `TableHead`, `TableRow`, `TableCell`, `TablePagination` e chips de status (`Chip color="success"|"warning"|"error"`).

5. **Tema Customizado DurvalCRM:**
   - Paleta primária configurada no `createTheme()` do MUI a partir das cores do logotipo (ver §2.3), com tons de suporte para estados de sucesso, alerta e erro.

### 2.3 Esquema de Cores: Logotipo [`ce_cairbar_logo.png`](ce_cairbar_logo.png)

O DurvalCRM usa a **mesma identidade visual da Comunidade Cairbar** (tema Keycloak/portal em `01-cairbar-identity-provider/theme/src/shared/theme.ts`), derivada do logotipo do CE Cairbar Schutel: ícone de faixas horizontais em azul claro e nome em grafite, sobre fundo claro.

| Papel no tema | Cor | Origem / uso |
|---|---|---|
| `primary.main` | `#2C698B` | Azul das faixas escurecido; botões, links, item ativo (6,0:1 sobre branco) |
| `primary.contrastText` | `#FFFFFF` | Texto sobre o azul principal |
| `primary.dark` / `secondary.main` | `#1B4055` | Hover, texto do item ativo do menu |
| `primary.light` | `#7DC1E7` | Azul das faixas do logotipo; só decorativo (faixa da AppBar, contorno de foco) |
| `text.primary` / `text.secondary` | `#111111` / `#4A5560` | Grafite do nome no logotipo |
| `background.default` / `background.paper` | `#F4F7FA` / `#FFFFFF` | Fundo claro |
| `success` / `warning` / `error` | `#2E7D32` / `#8A5300` / `#C62828` | Tons com 4,5:1 também como texto |

Diretrizes:
- Defina as cores somente no `createTheme()` (em `src/shared/theme/`); componentes usam `theme.palette.*`, nunca hex soltos.
- Tipografia Fira Sans (`@fontsource/fira-sans`), `shape.borderRadius` 10, botões sem caixa alta e sem elevação, cards `outlined`, AppBar branca com borda inferior, foco visível com contorno `primary.light`: os mesmos defaults do tema da Comunidade Cairbar. Ao alterar um dos dois temas, altere o outro.
- O shell segue o portal: AppBar fixa sobre o menu, com faixa azul de 4px e o logotipo; título da página em `h1` (2rem).
- Valide o contraste (WCAG AA) de toda combinação texto/fundo derivada da paleta.

---

## 3. Regra Fundamental da Clean Architecture no Backend

No backend, as dependências apontam **sempre para dentro**:

```
                    dependências apontam para dentro

    Infrastructure (Spring Boot, Hibernate, PostgreSQL, Keycloak)
         │
         ▼
    Application (Use Cases, Ports, DTOs de comando)
         │
         ▼
       Domain (Entidades, Value Objects, Regras de Negócio - Java Puro)
```

Ou, concretamente:

```
REST Controller
     │
     ▼
Use Case (Application)
     │
     ▼
Domain Model
     ▲
     │
Repository Port (Interface)
     ▲
     │
JPA Persistence Adapter
```

### O Domínio Não Conhece:
- Spring Boot / Spring MVC / Spring Data
- Spring Security / Keycloak / OAuth2 / JWT
- Hibernate / JPA / Anotações `@Entity`, `@Table`
- PostgreSQL / Drivers JDBC
- Tomcat / Protocolo HTTP / JSON

ArchUnit é executado no build para garantir que nenhuma dependência externa entre no pacote `domain`.

---

## 4. Organização dos Pacotes por Módulo de Negócio

Adota-se a estrutura de **Monólito Modular** alinhada ao domínio real do DurvalCRM:

```
com.durvalcrm
│
├── doador
│   ├── domain/               # Doador, DoadorId, Endereco, DoadorRepository
│   ├── application/          # CadastrarDoadorUseCase, BuscarDoadorUseCase
│   ├── adapter/
│   │   ├── in/rest/          # DoadorController, DoadorRequest, DoadorResponse
│   │   └── out/persistence/  # DoadorJpaEntity, SpringDataDoadorRepository, DoadorPersistenceAdapter
│   └── infrastructure/       # DoadorModuleConfiguration
│
├── contribuicao
│   ├── domain/               # Contribuicao, Competencia, MeioPagamento, ContribuicaoRepository
│   ├── application/          # RegistrarContribuicaoUseCase
│   └── adapter/ ...
│
├── venda
│   ├── domain/               # Venda, ItemVenda, TipoProduto (Cantina/Livro)
│   ├── application/          # RealizarVendaUseCase
│   └── adapter/ ...
│
├── estoque
│   ├── domain/               # ItemEstoque, MovimentacaoEstoque, TipoBaixa
│   ├── application/          # AtualizarEstoqueUseCase, SolicitarBaixaUseCase
│   └── adapter/ ...
│
├── intencaogasto
│   ├── domain/               # IntencaoGasto, StatusIntencao, CategoriaGasto
│   ├── application/          # SolicitarGastoUseCase, AprovarGastoUseCase
│   └── adapter/ ...
│
├── financeiro
│   ├── domain/               # ContaFinanceira, ContasRecebimento, Lancamento, Transferencia
│   ├── application/          # FechamentoMensalUseCase, ConciliarCartaoUseCase
│   └── adapter/ ...
│
├── editora
│   ├── domain/               # Editora, LivroConsignado, Remessa, Repasse
│   ├── application/          # RegistrarRemessaUseCase, CalcularRepasseUseCase
│   └── adapter/ ...
│
├── relatorio
│   ├── application/          # GerarPrestacaoContasUseCase
│   └── adapter/ ...
│
├── administracao
│   ├── domain/               # Usuario, ParametroGeral, PlanoContas
│   └── application/ ...
│
└── shared
    ├── domain/               # Money, Cpf, DataCompetencia, DomainException
    └── security/             # SecurityConfig, KeycloakJwtConverter, CurrentUserAdapter, CurrentUserPort
```

---

## 5. Exemplo de Módulo: Doador

```
doador/
│
├── domain/
│   ├── Doador.java                  # Entidade pura de domínio
│   ├── DoadorId.java                # Value Object
│   ├── Cpf.java                     # Value Object com validação
│   ├── StatusDoador.java            # Ativo / Inativo
│   └── DoadorRepository.java        # Porta de saída (Interface Java pura)
│
├── application/
│   ├── CadastrarDoadorUseCase.java  # Caso de uso (porta de entrada)
│   ├── CadastrarDoadorCommand.java  # DTO de entrada do caso de uso
│   └── BuscarDoadorUseCase.java
│
├── adapter/
│   ├── in/rest/
│   │   ├── DoadorController.java   # Controller REST
│   │   ├── DoadorRequest.java      # DTO HTTP com anotações de validação
│   │   └── DoadorResponse.java     # DTO de serialização JSON
│   │
│   └── out/persistence/
│       ├── DoadorJpaEntity.java             # Entidade JPA (@Entity, @Table)
│       ├── SpringDataDoadorRepository.java  # Spring Data JpaRepository
│       └── DoadorPersistenceAdapter.java    # Implementa DoadorRepository
│
└── infrastructure/
    └── DoadorConfiguration.java
```

Separação deliberada: `Doador` (domínio puro) vs. `DoadorJpaEntity` (persistência). O mapeamento é feito dentro de `DoadorPersistenceAdapter`.

---

## 6. Integração com Keycloak

O fluxo de autenticação e autorização ocorre via OpenID Connect com tokens JWT:

```
Frontend (Vite + React + MUI)
   │
   │ 1. Redirecionamento de Login (PKCE)
   ▼
Keycloak (Realm cecairbar)
   │
   │ 2. Emissão de JWT Access Token
   ▼
Frontend
   │
   │ 3. Authorization: Bearer <jwt>
   ▼
Spring Security (Resource Server)
   │
   │ 4. Valida assinatura (JWKS), expiração, issuer e extrai as roles
   ▼
REST Controller
   │
   ▼
Use Case (Application)
```

O frontend autentica no Keycloak e anexa o `Bearer Token` em cada requisição REST. O backend valida o token localmente usando a chave pública do Keycloak (`/certs`), sem chamadas síncronas adicionais.

---

## 7. Configuração do Spring Security

O DurvalCRM atua como **OAuth 2.0 Resource Server**:

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfiguration {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            KeycloakJwtAuthenticationConverter keycloakConverter) throws Exception {

        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth -> oauth
                .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakConverter))
            );

        return http.build();
    }
}
```

Configuração do Issuer no `application.yml`:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://<keycloak-host>/realms/cecairbar
```

---

## 8. Autenticação vs. Autorização

| Responsabilidade | Onde Fica | Exemplos |
|---|---|---|
| **Autenticação & Identidade** | **Keycloak** | Login, senha, MFA, recuperação de conta, claims básicas, roles de cliente (`operador`, `vendedor`, `tesoureiro`, `administrador`) |
| **Autorização de API** | **Spring Security** | `@PreAuthorize("hasRole('operador')")` para verificar acesso ao endpoint. |
| **Regras de Negócio de Autorização** | **Domain / Application** | "Este vendedor pode ver e cancelar esta venda?", "Em qual conta entra o PIX desta venda?", "O período de competência já foi fechado pelo tesoureiro?". |

---

## 9. CurrentUserPort e Inversão de Dependência

Os casos de uso dependem de uma abstração (`CurrentUserPort`), nunca do Spring Security ou Keycloak diretamente:

```java
public interface CurrentUserPort {
    String getSubject();
    String getUsername();
    String getEmail();
    boolean hasRole(String role);
}
```

O adaptador em `shared/security` extrai as informações do contexto de segurança:

```java
@Component
public class SpringSecurityCurrentUserAdapter implements CurrentUserPort {

    @Override
    public String getSubject() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return jwt.getSubject();
    }

    @Override
    public boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_" + role));
    }

}
```

---

## 10. Mapeamento de Roles do Keycloak

Os papéis são **realm roles** do realm `cecairbar`, criadas e atribuídas aos grupos pelo projeto de identidade
(`01-cairbar-identity-provider`). O client `durvalcrm-web` tem full scope desligado e recebe só as quatro roles do
DurvalCRM; o mapper `audiencia-api` põe `durvalcrm-api` no `aud`:

```json
{
  "sub": "a1b2c3d4-...",
  "preferred_username": "mariana.silva",
  "aud": "durvalcrm-api",
  "realm_access": {
    "roles": ["operador", "vendedor"]
  }
}
```

O converter (`shared/security/KeycloakJwtAuthenticationConverter`) mapeia só `operador`, `vendedor`, `tesoureiro` e
`administrador` para authorities Spring (`ROLE_OPERADOR`, `ROLE_VENDEDOR`); as demais realm roles (`schutelista`,
`bibliotecario`, default roles) são ignoradas.

---

## 11. Banco de Dados e Migrações

- **PostgreSQL**: banco de dados único (`durvalcrm`), isolado do banco do Keycloak.
- **Flyway**: versionamento rigoroso de todas as alterações de esquema (`V1__baseline.sql`, `V2__tabelas_vendas.sql`...).
- **Regra de ouro**: O DurvalCRM **nunca** acessa ou cria chaves estrangeiras para as tabelas internas do Keycloak. O vínculo é feito unicamente pelo campo `keycloak_subject` (`UUID` string).

---

## 12. Stack Tecnológica Consolidada

### Frontend
- **Framework & Build:** React 18+ com TypeScript e Vite
- **UI Design System:** Material UI v9.5.0 open source (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`)
- **Esquema de cores:** derivado do logotipo [`ce_cairbar_logo.png`](ce_cairbar_logo.png) e igual ao tema da Comunidade Cairbar (`primary` `#2C698B`, faixa `#7DC1E7`, texto `#111111`, fundo `#F4F7FA`, Fira Sans; ver §2.3)
- **Telas e Wireframe:** Fidelidade total ao layout [`Designer.png`](Designer.png) (Telas 1 a 12)
- **Roteamento:** React Router DOM
- **Gráficos:** Recharts / MUI X Charts
- **Testes & Mocks:** Vitest, Testing Library, MSW (Mock Service Worker)

### Backend
- **Linguagem & Runtime:** Java 21 LTS
- **Framework:** Spring Boot 4.x (Spring Web, Spring Security, Spring Data JPA, Spring Validation); a linha 3.x usa Tomcat 10.1, incompatível com o Tomcat 11 adotado
- **Servidor Web:** Tomcat 11 embarcado
- **Segurança:** Spring Security OAuth2 Resource Server + JWT
- **Persistência & ORM:** Hibernate 6 / Spring Data JPA
- **Banco de Dados:** PostgreSQL 18
- **Migrações de Banco:** Flyway
- **Build & Dependências:** Maven
- **Testes & Qualidade:** JUnit 5, Mockito, Testcontainers, ArchUnit

### Identidade & Infraestrutura
- **Servidor de Identidade:** Keycloak (Realm `cecairbar`, Client `durvalcrm-web` e `durvalcrm-api`)
- **Automação de Infraestrutura:** Ansible (Playbooks para PostgreSQL, Tomcat e Keycloak)
- **Hospedagem:** VM Linux (`vm-exp-durvalcrm`)
