
Especificação Técnica
Biblioteca Comunitária Espírita com Clean Architecture
Documento de origem: Especificação de Produto — Biblioteca Comunitária Espírita
Estilo arquitetural: Clean Architecture, DDD pragmático e arquitetura modular
Princípios de implementação: Clean Code, SOLID, baixo acoplamento, alta coesão, testes automatizados e dependências orientadas para o domínio
Canal: Aplicação web responsiva
Identidade: Keycloak
Escopo físico: Uma biblioteca


1. Objetivo técnico
Construir uma solução modular, testável e evolutiva para gestão do acervo físico e digital, circulação, descoberta e jornadas de leitura, mantendo as regras de negócio independentes de frameworks, banco de dados, protocolos, fornecedores de mensagens e mecanismos de identidade.
A regra central é:

As dependências de código sempre apontam das camadas externas para as camadas internas. O domínio não conhece banco de dados, interface web, Keycloak, WhatsApp, e-mail, armazenamento de arquivos ou bibliotecas de framework.




2. Decisão arquitetural principal
2.1 Modular monolith como ponto de partida
A solução deve iniciar como um monólito modular, organizado por bounded contexts. Cada módulo possui domínio, aplicação e adaptadores próprios, mas é implantado como uma única aplicação de backend.
Essa abordagem é indicada porque:

- a organização possui uma única biblioteca física;
- os fluxos de empréstimo, reserva, fila e exemplar exigem consistência transacional;
- o time evita inicialmente a complexidade operacional de microsserviços;
- os limites modulares permitem extração futura de módulos, se volume ou autonomia justificarem;
- testes, deploy e observabilidade são mais simples no MVP.
2.2 Separação física sugerida

/apps
  /web
  /api
/modules
  /identity-access
  /catalogue
  /collection
  /circulation
  /reader-journey
  /engagement
  /communication
  /library-operations
  /reporting
  /audit
/shared
  /kernel
  /application
  /infrastructure
  /testing


A estrutura exata deve respeitar a linguagem escolhida, porém os limites conceituais são obrigatórios.


3. Camadas da Clean Architecture
3.1 Camada 1 — Enterprise Business Rules: Domain
Contém as regras mais estáveis do negócio.
Inclui:

- Aggregates;
- Entities;
- Value Objects;
- Domain Services;
- Domain Events;
- Specifications;
- Policies;
- exceções de domínio;
- contratos de repositório estritamente necessários ao domínio, quando aplicável.
Não pode depender de:

- ORM;
- HTTP;
- JSON;
- filas;
- Keycloak;
- banco de dados;
- bibliotecas de e-mail ou WhatsApp;
- sistema de arquivos;
- framework web;
- classes de controller ou DTOs externos.
Exemplo:

Circulation.Domain
  Loan
  Reservation
  WaitingQueue
  CirculationLimit
  DueDatePolicy
  ReservationExpirationPolicy
  ReaderEligibilityPolicy
  LoanRenewed
  CopyReturned


3.2 Camada 2 — Application Business Rules: Use Cases
Orquestra casos de uso e transações. Não implementa regras fundamentais que pertencem ao domínio.
Inclui:

- Commands e Queries;
- Use Case Interactors ou Handlers;
- Input e Output Ports;
- Application Services;
- DTOs internos da aplicação;
- autorização por capacidade;
- coordenação de repositórios;
- publicação de eventos;
- controle de transação via abstração;
- idempotência e deduplicação de comandos.
Exemplos:

BorrowCopyCommand
ReturnCopyCommand
RenewLoanCommand
ReserveAvailableCopyCommand
JoinWaitingQueueCommand
AllocateReturnedCopiesCommand
GetReaderDashboardQuery


3.3 Camada 3 — Interface Adapters
Converte dados entre o mundo externo e os formatos dos casos de uso.
Inclui:

- REST controllers ou GraphQL resolvers;
- presenters;
- mappers;
- persistence adapters;
- implementações de repositórios;
- consumers e publishers de mensagens;
- adaptadores de Keycloak;
- adaptadores de busca;
- adaptadores de armazenamento digital;
- adaptadores de e-mail e WhatsApp.
Responsabilidades:

- validar formato, não regra de negócio;
- converter request externo em command/query;
- converter output do caso de uso em resposta;
- traduzir exceções conhecidas em códigos HTTP;
- impedir vazamento de entidades de persistência para o domínio.
3.4 Camada 4 — Frameworks and Drivers
Contém detalhes substituíveis:

- framework web;
- ORM;
- banco relacional;
- mecanismo de busca;
- Keycloak;
- broker ou mecanismo de filas;
- armazenamento de objetos;
- provedor de e-mail;
- provedor de WhatsApp;
- scheduler;
- geração de PDF, CSV, QR Code e etiquetas;
- logging, métricas e tracing.
Nenhuma decisão desta camada deve alterar a semântica do domínio.


4. Regra de dependência
4.1 Direção permitida

Frameworks/Drivers
        ↓
Interface Adapters
        ↓
Application/Use Cases
        ↓
Domain


4.2 Regras obrigatórias

1. Domain não referencia Application.
2. Application referencia Domain, mas não Frameworks.
3. Controllers não acessam ORM ou banco diretamente.
4. Repositórios concretos implementam portas definidas internamente.
5. Entidades de banco não são retornadas pela API.
6. Eventos externos são traduzidos para commands antes de chegar aos casos de uso.
7. Integrações externas entram por interfaces definidas na camada Application.
8. Regras de autorização funcional não ficam apenas na interface; devem ser validadas no caso de uso.


5. Bounded contexts e módulos
5.1 Identity & Access
Responsabilidade
Relacionar identidades autenticadas pelo Keycloak aos perfis e registros funcionais da biblioteca.
Domínio

- ReaderAccount;
- StaffAccount;
- Role: SCHUTELISTA, OPERADOR, BIBLIOTECARIO, ADMINISTRADOR (realm roles `schutelista`, `operador`, `bibliotecario` e `administrador` do realm `cecairbar`, lidas de `realm_access.roles`; Bibliotecário inclui as capacidades do Operador e Administrador todas, por regra da aplicação);
- AccountStatus;
- DigitalLibraryCard;
- CommunicationPreferences;
- ConsentRecord.
Casos de uso

- CompleteReaderRegistration;
- LinkImportedReaderToIdentity;
- IssueDigitalLibraryCard;
- UpdateCommunicationPreferences;
- CompleteReaderProfile;
- RequestPersonalDataExport;
- RequestAccountDeletion;
- AnonymiseReaderData.
Portas

- IdentityProvider;
- ReaderAccountRepository;
- ConsentRepository;
- PersonalDataExporter;
- CurrentUserContext.
Adaptadores

- KeycloakIdentityProvider;
- KeycloakTokenClaimsAdapter;
- REST account controller;
- PDF/CSV/JSON personal data exporter.
Limite
A aplicação não armazena senha. O Keycloak gerencia autenticação. O módulo mantém apenas o identificador externo e os dados funcionais necessários.


5.2 Catalogue
Responsabilidade
Representar obras, edições, créditos bibliográficos, classificação, pesquisa e apresentação pública.
Aggregates
Work
Raiz do conceito bibliográfico compartilhado entre edições.
Composição:

- WorkId;
- Title;
- Synopsis;
- MainCategoryId;
- ThemeIds;
- AudienceGroup;
- KnowledgeLevel opcional;
- Credits;
- PublicationStatus.
Invariantes:

- toda obra publicada possui título e categoria principal;
- uma obra possui no máximo uma categoria principal;
- nível de conhecimento é opcional;
- créditos devem apontar para pessoas bibliográficas válidas.
Edition

- EditionId;
- WorkId;
- PublisherId;
- PublicationYear;
- EditionDescription;
- ISBN opcional;
- Cover;
- Language;
- DigitalResources.
Invariantes:

- ISBN normalizado deve ser único por edição quando informado;
- arquivo hospedado aceita apenas PDF ou EPUB no MVP;
- política de acesso digital deve informar acesso e capacidades permitidas.
BibliographicPerson

- PersonId;
- Name;
- Biography;
- Image.
Value Objects

- ISBN;
- WorkTitle;
- CreditRole;
- AgeAudience;
- KnowledgeLevel;
- DigitalAccessPolicy;
- EditionNumber;
- SearchCriteria.
Casos de uso

- CreateWork;
- CreateEdition;
- RegisterEditionFromISBN;
- PublishWork;
- UpdateWork;
- AddBibliographicCredit;
- AssignTheme;
- MergeThemes;
- SearchCatalogue;
- GetWorkDetails;
- RegisterDigitalResource;
- ConfigureDigitalAccess.
Portas

- WorkRepository;
- EditionRepository;
- BibliographicPersonRepository;
- CategoryRepository;
- ThemeRepository;
- BibliographicMetadataProvider;
- CatalogueSearchIndex;
- DigitalAssetStorage.
Eventos

- WorkCreated;
- WorkPublished;
- EditionCreated;
- EditionMetadataUpdated;
- DigitalResourceRegistered;
- ThemeMerged.


5.3 Collection Management
Responsabilidade
Gerenciar exemplares físicos, QR Codes, localização, estados, histórico e inventário.
Aggregate Copy

- CopyId;
- EditionId;
- QrCode;
- CopyStatus;
- ShelfLocation;
- ConditionNotes;
- RetirementReason opcional.
Estados válidos:

- AVAILABLE;
- LOANED;
- RESERVED;
- DAMAGED;
- UNDER_REPAIR;
- LOST;
- RETIRED.
Observação: NOT_LOCATED_IN_INVENTORY deve ser uma ocorrência de inventário, não necessariamente o estado definitivo do exemplar.
Invariantes

- QR Code é único e imutável;
- exemplar emprestado não pode ser reservado;
- exemplar perdido ou baixado não pode circular;
- baixa exige motivo;
- exemplar disponível deve possuir localização ativa;
- mudanças de estado devem respeitar uma máquina de estados explícita.
Casos de uso

- RegisterCopy;
- GenerateCopyQrCode;
- GenerateLabelBatch;
- MoveCopy;
- MarkCopyDamaged;
- SendCopyToRepair;
- ReturnCopyFromRepair;
- MarkCopyLost;
- RetireCopy;
- GetCopyHistory;
- StartInventory;
- ScanInventoryCopy;
- FinishInventory;
- ResolveInventoryDiscrepancy.
Portas

- CopyRepository;
- LocationRepository;
- InventoryRepository;
- QrCodeGenerator;
- LabelDocumentGenerator.
Eventos

- CopyRegistered;
- CopyStatusChanged;
- CopyMoved;
- CopyMarkedLost;
- CopyRetired;
- InventoryStarted;
- InventoryDiscrepancyDetected;
- InventoryFinished.


5.4 Circulation
Responsabilidade
Aplicar regras de empréstimo, devolução, renovação, reserva, fila, atraso e reposição.
Aggregate Loan

- LoanId;
- ReaderId;
- CopyId;
- WorkId;
- CheckoutAt;
- DueAt;
- ReturnedAt opcional;
- RenewalCount;
- Status.
Invariantes:

- prazo padrão de 30 dias corridos;
- no máximo uma renovação;
- renovação disponível apenas nos últimos 7 dias do período original;
- devolução encerra o empréstimo uma única vez;
- vencimento é ajustado ao próximo período aberto.
Aggregate Reservation

- ReservationId;
- ReaderId;
- WorkId;
- PreferredEditionId opcional;
- AllocatedCopyId;
- Origin;
- StartsAt;
- ExpiresAt;
- PausedDuration;
- Status.
Invariantes:

- reserva ativa ocupa uma posição do limite de 2;
- validade corresponde a 24 horas de funcionamento;
- cancelamento ou expiração de reserva de fila encerra aquela participação;
- suspensão operacional pausa o tempo restante.
Aggregate WaitingQueue

- QueueId;
- WorkId;
- Entries;
QueueEntry

- ReaderId;
- PreferredEditionId opcional;
- EnteredAt;
- Status.
Invariantes:

- ordem baseada no momento de entrada;
- leitor inelegível é ignorado sem perder sua posição;
- uma entrada ativa por leitor e obra;
- alocação respeita compatibilidade de edição.
Domain services e policies

- CirculationLimitPolicy;
- SameWorkRestrictionPolicy;
- ReaderEligibilityPolicy;
- DueDatePolicy;
- RenewalEligibilityPolicy;
- ReservationExpirationPolicy;
- CopyAllocationPolicy;
- QueueOrderingPolicy;
- ReplacementPolicy.
Casos de uso

- BorrowCopy;
- ReturnCopy;
- RenewLoan;
- CorrectLoan;
- CancelLoan;
- ReserveAvailableCopy;
- CancelReservation;
- JoinWaitingQueue;
- LeaveWaitingQueue;
- AllocateReturnedCopies;
- ExpireReservations;
- PauseReservations;
- ResumeReservations;
- RegisterOverdueContact;
- MarkLoanCopyLost;
- RegisterReplacementCommitment;
- RegisterReplacementCopy.
Portas

- LoanRepository;
- ReservationRepository;
- WaitingQueueRepository;
- ReaderCirculationSnapshot;
- LibraryCalendar;
- UnitOfWork;
- DomainEventPublisher;
Eventos

- CopyBorrowed;
- LoanRenewed;
- CopyReturned;
- LoanBecameOverdue;
- ReservationCreated;
- ReservationCancelled;
- ReservationExpired;
- ReaderJoinedQueue;
- ReaderLeftQueue;
- CopyAllocatedFromQueue;
- ReplacementCommitted.


5.5 Reader Journey
Responsabilidade
Gerenciar a experiência privada do leitor: “Quero ler”, conclusão, releitura, interesses e indicadores pessoais.
Aggregates
ReadingRecord

- ReadingId;
- ReaderId;
- WorkId;
- SourceType: LOAN | DIGITAL;
- SourceId;
- CompletedAt;
- IsReread.
ReaderReadingProfile

- ReaderId;
- ThemeInterests;
- AuthorInterests;
- KnowledgeLevelInterest opcional;
- WantToReadWorks.
Regras

- devolução não cria conclusão automaticamente;
- conclusão exige ação explícita do leitor;
- a mesma obra pode gerar várias leituras;
- “obras diferentes” usa WorkId distinto;
- “leituras concluídas” conta todos os ReadingRecords;
- indicadores pessoais são privados.
Casos de uso

- AddWorkToWantToRead;
- RemoveWorkFromWantToRead;
- CompleteReading;
- UpdateReaderInterests;
- GetReaderJourneyDashboard;
- GetReadingHistory.
Eventos

- WorkAddedToWantToRead;
- ReadingCompleted;
- ReadingCompletedAgain;
- ReaderInterestsUpdated.


5.6 Reviews & Moderation
Responsabilidade
Gerenciar avaliação por estrelas, recomendação, comentário opcional e moderação.
Aggregate Review

- ReviewId;
- ReaderId;
- WorkId;
- Rating;
- Recommends;
- Comment opcional;
- IdentityDisplay;
- CommentModerationStatus;
- CreatedAt;
- UpdatedAt.
Invariantes

- estrelas são inteiros entre 1 e 5;
- recomendação é obrigatória quando avaliação é submetida;
- comentário é opcional;
- uma avaliação vigente por leitor e obra;
- edição posterior substitui a avaliação anterior;
- estrelas e recomendação entram nos agregados imediatamente;
- comentário só é público após aprovação;
- avaliação exige leitura concluída ou acesso digital elegível;
- oportunidade de avaliação é criada na conclusão e encerrada se recusada.
Casos de uso

- OfferReviewOpportunity;
- SubmitReview;
- DeclineReviewOpportunity;
- UpdateReviewAfterReread;
- ApproveComment;
- RejectComment;
- GetWorkReviewSummary.
Portas

- ReviewRepository;
- ReadingEligibilityGateway;
- ReviewSummaryProjection.
Eventos

- ReviewSubmitted;
- ReviewUpdated;
- CommentSubmittedForModeration;
- CommentApproved;
- CommentRejected.


5.7 Engagement & Editorial
Responsabilidade
Listas temáticas, campanhas, conquistas, sugestões e conteúdo editorial.
Este módulo pode ser parcialmente Pós-MVP sem alterar os contratos do núcleo.
Aggregates

- ThematicList;
- ReadingCampaign;
- Achievement;
- ReaderCampaignParticipation;
- ReaderSuggestion;
- EditorialBanner;
- OperationalNotice.
Casos de uso

- CreateThematicList;
- AddWorkToList;
- CreateCampaign;
- EnrolReaderInCampaign;
- EvaluateCampaignProgress;
- AwardAchievement;
- SubmitSuggestion;
- ReviewSuggestion;
- ScheduleEditorialBanner;
- PublishOperationalNotice.
Eventos

- ReaderEnrolledInCampaign;
- CampaignCompleted;
- AchievementAwarded;
- SuggestionSubmitted;
- SuggestionReviewed;
- EditorialContentPublished.


5.8 Communication
Responsabilidade
Consumir eventos de negócio e produzir comunicações, sem contaminar o domínio com detalhes dos canais.
Aggregate/configuração

- NotificationTemplate;
- TemplateVersion;
- DeliveryAttempt;
- CommunicationPreferenceSnapshot.
Casos de uso

- ScheduleNotification;
- DeliverNotification;
- RetryFailedDelivery;
- ManuallyResendNotification;
- EditTemplate;
- TestTemplate;
- RestoreTemplateVersion.
Portas

- EmailSender;
- WhatsAppSender;
- NotificationRepository;
- TemplateRepository;
- NotificationScheduler;
- LinkGenerator.
Eventos consumidos

- CopyBorrowed;
- CopyReturned;
- ReservationCreated;
- CopyAllocatedFromQueue;
- LoanRenewed;
- LoanBecameOverdue;
- SuggestionReviewed.
Regras técnicas

- envio é assíncrono;
- falha no envio não desfaz a transação de empréstimo ou devolução;
- cada mensagem possui chave de idempotência;
- comunicações críticas continuam tentando o canal com falha;
- falha persistente cria pendência operacional.


5.9 Library Operations
Responsabilidade
Calendário, horários, exceções e suspensão seletiva de operações.
Aggregate LibrarySchedule

- WeeklyOpeningHours;
- CalendarExceptions;
- OperationalSuspensions.
Casos de uso

- ConfigureOpeningHours;
- AddCalendarException;
- SuspendOperation;
- ResumeOperation;
- CalculateNextOpenInstant;
- CalculateOpenHoursDuration.
Porta

- LibraryCalendarService.
O módulo Circulation depende desta porta, não da implementação do calendário.


5.10 Reporting & Projections
Responsabilidade
Construir modelos de leitura otimizados para dashboards e relatórios.
Projeções

- OperationalDashboardProjection;
- EngagementDashboardProjection;
- CollectionStatusProjection;
- ReaderPrivateDashboardProjection;
- OverdueLoansProjection;
- CampaignAggregateProjection.
Regras

- projeções administrativas de engajamento não expõem dados individuais;
- dashboards não consultam aggregates diretamente para montar análises extensas;
- consistência eventual é aceitável para projeções, nunca para decisão de circulação;
- relatórios podem ser exportados em PDF e CSV/Excel.
Casos de uso

- GetOperationalDashboard;
- GetEngagementDashboard;
- GenerateFilteredReport;
- ExportReport.


5.11 Audit
Responsabilidade
Registrar ações sensíveis e permitir consulta autorizada.
AuditRecord

- AuditId;
- ActorId;
- OccurredAt;
- Module;
- EntityType;
- EntityId;
- Action;
- Before opcional;
- After opcional;
- CorrelationId.
Regras

- registros são append-only;
- dados sensíveis devem ser mascarados;
- retenção é configurável;
- somente administrador consulta;
- falha de auditoria em operação crítica deve ser tratada conforme política técnica definida, sem auditoria “silenciosa”.


6. Shared Kernel
O Shared Kernel deve ser pequeno e estável.
Pode conter:

- EntityId;
- DomainEvent;
- AggregateRoot;
- Result/Error;
- Clock;
- Money apenas se futuramente necessário;
- DateRange;
- Pagination;
- CorrelationId;
- ActorId;
- abstrações transacionais mínimas.
Não deve conter:

- entidades de negócio genéricas;
- repositório universal;
- serviços utilitários sem coesão;
- DTOs compartilhados entre módulos;
- enums específicos de um bounded context;
- dependências de framework.


7. Casos de uso críticos detalhados
7.1 BorrowCopy
Input

- readerId;
- copyQrCode;
- operatorId;
- requestId.
Fluxo

1. Carregar leitor e snapshot de circulação.
2. Resolver exemplar pelo QR Code.
3. Validar que o exemplar está AVAILABLE ou RESERVED para aquele leitor.
4. Identificar WorkId por EditionId.
5. Aplicar CirculationLimitPolicy.
6. Aplicar SameWorkRestrictionPolicy.
7. Calcular vencimento por DueDatePolicy e LibraryCalendar.
8. Criar Loan.
9. Alterar exemplar para LOANED.
10. Consumir reserva, quando existente.
11. Persistir na mesma transação.
12. Publicar CopyBorrowed após commit.
Saída

- loanId;
- borrowedAt;
- dueAt;
- readerCirculationSummary.
Erros de domínio

- ReaderNotEligible;
- CirculationLimitReached;
- SameWorkAlreadyCommitted;
- CopyNotAvailable;
- ReservationBelongsToAnotherReader;
- LibraryOperationSuspended.
7.2 ReturnCopy
Fluxo

1. Resolver exemplar pelo QR Code.
2. Localizar empréstimo ativo.
3. Registrar devolução.
4. Aplicar condição informada pelo operador.
5. Se apto, procurar fila compatível.
6. Alocar exemplar ao primeiro leitor elegível ou alterar para AVAILABLE.
7. Persistir atomicamente empréstimo, exemplar, reserva e fila.
8. Publicar CopyReturned e, quando aplicável, CopyAllocatedFromQueue.
7.3 AllocateReturnedCopies
Regras

- processar todos os exemplares liberados;
- preservar ordem lógica da fila;
- respeitar preferência de edição;
- ignorar temporariamente leitores inelegíveis;
- não remover posição do leitor ignorado;
- criar uma reserva por exemplar;
- impedir alocação duplicada por concorrência.
Concorrência
Usar lock otimista por versão do aggregate WaitingQueue ou lock transacional sobre a fila da obra. O caso de uso deve ser idempotente por evento de disponibilidade.
7.4 CompleteReading
Fluxo

1. Validar fonte elegível de leitura física ou digital.
2. Verificar se já existe conclusão relacionada à mesma interação.
3. Criar ReadingRecord.
4. Calcular se é releitura.
5. Publicar ReadingCompleted.
6. Criar ReviewOpportunity.
7. Atualizar projeções pessoais de forma assíncrona.


8. Persistência
8.1 Estratégia

- Banco relacional para dados transacionais.
- Tabelas separadas por módulo ou schemas lógicos separados.
- Um módulo não consulta diretamente tabelas privadas de outro módulo.
- Integração entre módulos por portas, application services e eventos internos.
- Projeções podem possuir tabelas desnormalizadas próprias.
8.2 Mapeamento
Entidades de persistência devem ser separadas das entidades de domínio quando o ORM exigir anotações, proxies, setters públicos ou formatos incompatíveis com as invariantes.

LoanDomainEntity
        ↕ mapper
LoanPersistenceEntity


8.3 Concorrência
Aplicar versionamento otimista em:

- Copy;
- Loan;
- Reservation;
- WaitingQueue;
- Inventory;
- Review;
- NotificationTemplate.
Aplicar constraints de banco para proteger:

- QR Code único;
- ISBN normalizado único quando não nulo;
- uma avaliação por leitor e obra;
- uma entrada ativa de fila por leitor e obra;
- um empréstimo ativo por exemplar;
- uma reserva ativa por exemplar.
8.4 Transações
Transações obrigatórias:

- empréstimo + exemplar + consumo de reserva;
- devolução + exemplar + alocação da fila;
- expiração + exemplar + próxima alocação;
- baixa do exemplar + histórico;
- resolução de divergência de inventário.


9. Eventos e consistência
9.1 Domain Events
Representam fatos ocorridos dentro de uma transação de domínio.
9.2 Integration Events
São versões estáveis e serializáveis publicadas para outros módulos ou componentes assíncronos.
Exemplo:

Domain: CopyBorrowed
Integration: circulation.copy-borrowed.v1


9.3 Outbox Pattern
Eventos que disparam notificação, projeção ou integração devem ser gravados na mesma transação do estado de negócio e publicados posteriormente por um dispatcher.
Objetivo:

- evitar empréstimo confirmado sem evento de comunicação persistido;
- permitir retentativa;
- garantir idempotência;
- desacoplar transação principal dos fornecedores externos.
9.4 Idempotência
Obrigatória em:

- importação;
- webhooks externos;
- consumers de eventos;
- envio de notificações;
- alocação de fila;
- jobs de expiração;
- correções operacionais.


10. APIs e contratos
10.1 Estilo

- API HTTP versionada para operações síncronas.
- Commands retornam resultado da operação, não entidades internas.
- Queries retornam read models.
- Erros seguem formato consistente com código, mensagem e correlationId.
10.2 Endpoints representativos

GET    /api/v1/catalogue/works
GET    /api/v1/catalogue/works/{workId}
POST   /api/v1/reader/want-to-read/{workId}
POST   /api/v1/circulation/reservations
DELETE /api/v1/circulation/reservations/{reservationId}
POST   /api/v1/circulation/queues
DELETE /api/v1/circulation/queues/{queueEntryId}
POST   /api/v1/operator/loans
POST   /api/v1/operator/returns
POST   /api/v1/reader/loans/{loanId}/renew
POST   /api/v1/reader/readings
POST   /api/v1/reader/reviews
POST   /api/v1/collection/copies
POST   /api/v1/collection/inventories
POST   /api/v1/collection/inventories/{inventoryId}/scans
GET    /api/v1/admin/dashboards/operational
GET    /api/v1/admin/dashboards/engagement


10.3 Segurança

- validar JWT do Keycloak no adapter HTTP;
- converter claims em CurrentUserContext;
- validar capacidade no use case;
- não confiar em role enviada no body;
- autorização por operação e recurso;
- access tokens não são persistidos pela aplicação;
- dados pessoais e URLs de arquivos privados não aparecem em logs.


11. Jobs e processamento assíncrono
Jobs necessários:

- expirar reservas;
- retomar reservas pausadas;
- detectar empréstimos vencidos;
- agendar lembretes de atraso;
- publicar Outbox;
- reprocessar notificações;
- atualizar projeções;
- ativar/desativar banners e avisos agendados;
- aplicar retenção de auditoria;
- processar importações em lote.
Cada job deve:

- possuir lock distribuído ou mecanismo equivalente;
- ser idempotente;
- registrar início, resultado e falha;
- processar em lotes limitados;
- permitir retentativa segura;
- usar Clock injetável em testes.


12. Clean Code
12.1 Nomes

- usar vocabulário do domínio;
- preferir RenewLoan a UpdateLoanStatus;
- preferir AllocateCopyToNextEligibleReader a ProcessQueue;
- evitar nomes genéricos como Manager, Helper, Util e Processor sem contexto.
12.2 Funções e classes

- um caso de uso por handler/interactor;
- funções pequenas e com uma intenção;
- evitar parâmetros booleanos que alterem comportamento;
- encapsular primitives relevantes em Value Objects;
- controllers finos;
- regras dentro do domínio, não em mappers ou repositories;
- comentários explicam decisão ou restrição, não repetem o código.
12.3 Erros
Usar erros semânticos:

CirculationLimitReached
CopyNotAvailable
RenewalWindowNotOpen
ReviewOpportunityClosed
CommentAwaitingModeration


Não usar mensagens textuais como mecanismo de decisão.
12.4 Imutabilidade

- Value Objects imutáveis;
- status alterado apenas por métodos do aggregate;
- coleções internas não expostas para mutação;
- data/hora obtida por Clock, não diretamente do sistema.
12.5 SOLID

- SRP: cada módulo e classe possui uma razão principal para mudar.
- OCP: novos canais de comunicação entram por adapters.
- LSP: implementações respeitam contratos e semântica das portas.
- ISP: portas pequenas, específicas por caso de uso.
- DIP: casos de uso dependem de interfaces internas, nunca de providers concretos.


13. Estratégia de testes
13.1 Testes de domínio
Obrigatórios para:

- limite de 2 itens;
- restrição da mesma obra;
- janela e quantidade de renovações;
- cálculo de vencimento;
- 24 horas de funcionamento;
- pausa e retomada de reservas;
- elegibilidade e ordenação da fila;
- releitura;
- moderação de comentários;
- transições de estado do exemplar.
Sem banco, rede ou framework.
13.2 Testes de aplicação
Testar cada use case com portas em memória:

- caminhos felizes;
- violações de regra;
- idempotência;
- publicação de eventos;
- autorização;
- rollback transacional.
13.3 Testes de adapters

- integração com banco real em container;
- mapeamento ORM;
- constraints;
- Keycloak contract tests;
- storage de arquivos;
- providers de e-mail/WhatsApp em sandbox ou adapter fake;
- geração de QR Code e etiquetas.
13.4 Testes de contrato

- OpenAPI;
- schemas de integration events;
- compatibilidade retroativa de eventos versionados;
- contratos da importação Excel/CSV.
13.5 Testes end-to-end prioritários

1. cadastro → validação → reserva → empréstimo → devolução;
2. fila → devolução → alocação → retirada;
3. renovação nos últimos 7 dias;
4. inventário → divergência → resolução;
5. conclusão → avaliação → moderação;
6. falha de WhatsApp → retentativa → pendência operacional;
7. migração com ISBN duplicado e cadastro incompleto.
13.6 Qualidade

- nenhuma regra crítica validada somente por teste E2E;
- cobertura de domínio e aplicação priorizada sobre cobertura de getters/mappers;
- mutation testing recomendado para políticas de circulação;
- architecture tests para impedir dependências proibidas.


14. Observabilidade e operação
Embora observabilidade seja responsabilidade da infraestrutura, a aplicação deve produzir sinais adequados.
Logs estruturados
Campos mínimos:

- timestamp;
- level;
- correlationId;
- actorId mascarado quando necessário;
- module;
- useCase;
- result;
- errorCode.
Métricas

- duração e resultado dos casos de uso;
- reservas expiradas;
- tamanho e tempo de espera de filas técnicas;
- falhas e retentativas de notificações;
- atraso do Outbox;
- falhas de jobs;
- duração de importações.
Tracing
Preservar correlationId entre request, transação, evento, job e envio externo.
Health checks

- liveness da aplicação;
- readiness do banco, Keycloak, armazenamento e componentes assíncronos;
- falha de provider de comunicação não deve necessariamente tornar a API de circulação indisponível.


15. Segurança e privacidade

- TLS em trânsito;
- criptografia de storage conforme plataforma;
- princípio do menor privilégio;
- URLs temporárias para arquivos digitais privados;
- validação de formato e antivírus para uploads;
- limites de tamanho para PDF, EPUB e imagens;
- sanitização de comentários, biografias e conteúdo editorial;
- proteção contra enumeração de leitores;
- rate limiting em cadastro, login indireto, busca e download;
- mascaramento de dados pessoais em logs e auditoria;
- segregação entre histórico operacional e dados identificáveis;
- anonimização preservando integridade referencial;
- retenção configurável de auditoria;
- exportação pessoal acessível apenas ao titular autenticado.


16. Importação e migração
Pipeline

Upload
  → validação de formato
  → staging
  → normalização
  → detecção de duplicidade
  → enriquecimento por ISBN
  → revisão humana
  → commit
  → relatório de resultado


Regras

- importar para staging antes do domínio;
- nenhuma linha inválida pode contaminar agregados válidos;
- ISBN idêntico sugere mesma edição;
- registros ambíguos permanecem pendentes;
- todas as decisões manuais ficam auditadas;
- reprocessamento do mesmo arquivo não pode duplicar dados;
- empréstimos ativos mantêm datas originais;
- leitor incompleto é preservado e marcado para complementação.


17. Organização da solução por módulo
Exemplo independente de linguagem:

/modules/circulation
  /domain
    /aggregates
    /entities
    /value-objects
    /events
    /policies
    /errors
  /application
    /commands
    /queries
    /ports
    /dto
  /adapters
    /inbound/http
    /inbound/jobs
    /outbound/persistence
    /outbound/events
  /infrastructure
    /database
    /messaging
    /configuration
  /tests
    /domain
    /application
    /integration


Repetir a organização para cada bounded context. Não organizar todo o backend apenas por diretórios globais controllers, services e repositories, pois isso reduz a coesão por domínio.


18. Definition of Done técnica
Uma história só pode ser concluída quando:

1. regra implementada no módulo e camada corretos;
2. nenhuma dependência proibida for introduzida;
3. testes de domínio e aplicação cobrirem regras e falhas;
4. contratos de API/evento estiverem atualizados;
5. migração de banco for versionada e reversível quando aplicável;
6. logs, métricas e auditoria necessários estiverem implementados;
7. autorização for validada no caso de uso;
8. erros forem semânticos e mapeados para resposta consistente;
9. critérios WCAG aplicáveis à interface estiverem atendidos;
10. código passar por lint, análise estática e architecture tests;
11. dados sensíveis não aparecerem em logs ou responses indevidas;
12. documentação do módulo e decisões arquiteturais forem atualizadas.


19. Architecture Decision Records iniciais
Criar os seguintes ADRs no repositório:

- ADR-001: Modular Monolith como topologia inicial;
- ADR-002: Clean Architecture e regra de dependência;
- ADR-003: Bounded contexts e ownership de dados;
- ADR-004: Keycloak como provedor de identidade;
- ADR-005: Banco relacional e separação entre domínio e persistência;
- ADR-006: Outbox Pattern para eventos pós-transação;
- ADR-007: Consistência transacional em circulação;
- ADR-008: Estratégia de filas de espera e concorrência;
- ADR-009: Storage e autorização de obras digitais;
- ADR-010: Comunicação assíncrona e idempotência;
- ADR-011: Projeções para dashboards e privacidade;
- ADR-012: Política de auditoria e retenção;
- ADR-013: Importação por staging e revisão humana;
- ADR-014: Testes de arquitetura para enforcement das camadas.


20. Sequência técnica recomendada do MVP
Fundação

- Shared Kernel mínimo;
- composição da aplicação;
- Keycloak adapter;
- persistência e Unit of Work;
- Outbox;
- auditoria;
- error handling e correlationId.
Incremento 1 — Catálogo e acervo

- Catalogue;
- Collection Management;
- cadastro Obra → Edição → Exemplar;
- QR Code;
- localização;
- catálogo público básico.
Incremento 2 — Circulação

- leitores;
- empréstimo;
- devolução;
- renovação;
- calendário;
- comprovantes.
Incremento 3 — Reservas e filas

- reserva direta;
- fila de espera;
- alocação automática;
- expiração;
- concorrência e idempotência.
Incremento 4 — Área do leitor

- empréstimos e reservas;
- “Quero ler”;
- conclusão;
- indicadores privados;
- avaliação e moderação.
Incremento 5 — Operação

- inventário;
- importação;
- dashboards;
- relatórios;
- falhas funcionais de comunicação.
Incremento 6 — Evoluções Pós-MVP

- busca semântica;
- recomendações;
- listas temáticas;
- campanhas;
- conquistas;
- conteúdo editorial avançado.


21. Restrições arquiteturais finais

- O domínio de circulação é a autoridade sobre empréstimos, reservas e filas.
- Collection Management é a autoridade sobre estado físico e localização do exemplar.
- Catalogue é a autoridade sobre Obra e Edição.
- Identity & Access é a autoridade sobre a identidade funcional do leitor, mas não sobre credenciais.
- Reader Journey é a autoridade sobre conclusões e indicadores pessoais.
- Reviews é a autoridade sobre avaliações e moderação.
- Reporting nunca decide regras operacionais.
- Communication nunca altera o sucesso de uma transação de circulação.
- Audit registra fatos, mas não coordena casos de uso.
- Nenhum módulo pode escrever diretamente nas tabelas privadas de outro módulo.
- Toda dependência externa deve possuir uma porta interna e um adapter substituível.
