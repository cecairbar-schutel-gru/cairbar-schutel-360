
Especificação de Produto
Biblioteca Comunitária Espírita
Status: Versão consolidada para planejamento do MVP
Idioma: Português
Canal: Aplicação web responsiva
Unidade física: Uma biblioteca
Autenticação e autorização: Keycloak
Acessibilidade: WCAG 2.2 nível AA


1. Visão do produto
Criar uma biblioteca comunitária física e digital que facilite o acesso às obras espíritas, fomente a leitura e fortaleça o senso de comunidade da organização por meio de catálogo público, curadoria, jornadas de leitura e gestão simples do acervo.
O produto não deve ser apenas um sistema de controle de empréstimos. A experiência central deve conectar cinco momentos:

1. Descobrir uma obra relevante.
2. Acessar a obra em formato físico ou digital.
3. Ler com autonomia e lembretes não punitivos.
4. Concluir e avaliar a leitura.
5. Continuar a jornada, recebendo novas recomendações, participando de campanhas e conquistando reconhecimentos.
1.1 Objetivos

- Tornar o acervo físico e digital facilmente pesquisável.
- Reduzir o esforço operacional de cadastro, empréstimo, devolução e inventário.
- Estimular novas leituras por curadoria, campanhas, recomendações e conquistas.
- Preservar a privacidade dos hábitos individuais de leitura.
- Permitir participação comunitária sem transformar o produto em uma rede social.
- Garantir rastreabilidade das movimentações do acervo.
1.2 Perfis
Os perfis são realm roles do realm compartilhado cecairbar (o mesmo do DurvalCRM), atribuídas por grupo no projeto de identidade. Revisados em 26/10/2026.
Schutelista (leitor)
Perfil padrão atribuído a todo usuário que faz o autocadastro pela Comunidade Cairbar ou é cadastrado pelo operador. Consulta o catálogo, acessa obras digitais permitidas, encomenda e reserva livros, entra em filas, realiza empréstimos e acompanha seu status de leitor na gamificação (lista “Quero ler”, leituras confirmadas, avaliações e campanhas).
Operador
Cadastra leitores; emite empréstimos, recebe devoluções, cadastra listas de espera e monta listas de livros temáticas.
Bibliotecário
Possui as funções do Operador e o gerenciamento completo do inventário da biblioteca: obras, edições e exemplares, estados e localizações, taxonomia, obras digitais e inventários.
Administrador
Acesso completo: possui as capacidades do Operador e do Bibliotecário e administra usuários e permissões por meio da integração com Keycloak, categorias, configurações, moderação, campanhas, comunicação, conteúdo editorial, relatórios e auditoria.


2. Escopo do MVP obrigatório
O MVP deve viabilizar a operação completa da biblioteca física e uma experiência digital básica de descoberta, acesso e acompanhamento.
2.1 Identidade e leitores

- Autenticação e autorização integradas ao Keycloak.
- Perfis Schutelista, Operador, Bibliotecário e Administrador.
- Autocadastro de leitor com validação de e-mail.
- Cadastro de leitor pelo operador.
- Dados do leitor: 
- nome completo;
- telefone/WhatsApp;
- e-mail;
- data de nascimento.
- Localização do leitor no balcão por nome, e-mail ou carteirinha digital.
- Carteirinha digital com QR Code pessoal e número legível.
- Preferências separadas para comunicações operacionais e de engajamento, por e-mail e WhatsApp.
- Aceite de termos e política de privacidade.
- Onboarding opcional para seleção de temas, autores e nível de interesse.
2.2 Catálogo público

- Consulta sem autenticação.
- Busca por título, autoria e ISBN.
- Busca ampliada em categoria, temas e sinopse.
- Tolerância básica a erros de digitação.
- Filtros por: 
- disponibilidade;
- formato físico/digital;
- categoria;
- temas;
- autoria e papel;
- editora;
- avaliação;
- edição;
- listas e campanhas;
- faixa etária;
- nível de conhecimento.
- Ordenação por relevância, popularidade, avaliação, novidades, título e disponibilidade.
- Página de detalhes da obra com: 
- capa;
- título e sinopse;
- categoria e temas;
- autores e papéis;
- edições;
- disponibilidade física;
- estante e prateleira;
- opções digitais;
- avaliações;
- ações de reserva, fila, “Quero ler” e compartilhamento.
2.3 Modelo bibliográfico e acervo

- Estrutura Obra → Edição → Exemplar.
- Cadastro da obra com: 
- título;
- sinopse;
- categoria principal;
- temas;
- faixa etária editorial;
- nível opcional: Iniciante, Intermediário ou Aprofundado.
- Cadastro da edição com: 
- editora;
- ano;
- número/descrição da edição;
- ISBN;
- capa;
- arquivos ou links digitais.
- Cadastro de pessoas vinculadas à obra com papéis, incluindo autor, autor espiritual e psicógrafo/médium.
- Cadastro assistido por ISBN para sugerir metadados e capa, sempre com revisão do operador.
- Cadastro manual para obras sem ISBN.
- Múltiplas edições por obra.
- Múltiplos exemplares físicos por edição.
- QR Code único por exemplar.
- Impressão individual e em lote das etiquetas.
- Localização estruturada por estante e prateleira.
- Cadastro estruturado de estantes e prateleiras.
- Estados do exemplar: 
- Disponível;
- Emprestado;
- Reservado;
- Danificado;
- Em manutenção/reparo;
- Perdido/extraviado;
- Baixado do acervo.
- Histórico completo do exemplar.
2.4 Circulação

- Empréstimo presencial com o fluxo: 
1. identificar leitor;
2. escanear QR Code do exemplar;
3. validar regras;
4. confirmar empréstimo.
- Prazo padrão de 30 dias corridos.
- Uma renovação de mais 30 dias.
- Renovação disponível nos últimos 7 dias do prazo original.
- Renovação pelo leitor ou operador.
- Limite de 2 itens comprometidos por leitor, somando empréstimos e reservas ativas.
- Proibição de empréstimo, reserva ou fila adicional da mesma obra enquanto houver empréstimo ou reserva ativa dessa obra.
- Releitura permitida após devolução.
- Comprovante de empréstimo por e-mail e WhatsApp.
- Devolução por leitura do QR Code.
- Confirmação de devolução por e-mail e WhatsApp.
- Na devolução, possibilidade de registrar condição do exemplar.
- Correção ou cancelamento pelo próprio operador, com auditoria.
2.5 Reservas e filas

- Reserva de exemplar disponível pelo catálogo.
- Escolha entre qualquer edição disponível ou edição específica.
- Validade de 24 horas de funcionamento da biblioteca.
- Cancelamento da reserva pelo próprio leitor.
- Fila de espera quando não houver exemplar disponível.
- Fila por ordem de solicitação e preferência de edição.
- Quando houver disponibilidade, criação automática de reserva para o primeiro leitor elegível.
- Aviso de disponibilidade por e-mail e WhatsApp.
- Se o primeiro leitor atingir o limite de 2 itens, ele é temporariamente ignorado, mantém a posição e o sistema procura o próximo elegível.
- Reservas expiradas ou canceladas removem o leitor daquela fila.
- Múltiplos exemplares liberados atendem múltiplos leitores elegíveis simultaneamente.
- O leitor pode sair da fila a qualquer momento.
2.6 Calendário

- Configuração dos dias e horários regulares de funcionamento.
- Exceções para feriados, recessos, dias fechados e horários especiais.
- Reservas calculadas apenas sobre períodos de funcionamento.
- Vencimento de empréstimo ou renovação em período fechado é transferido para o próximo período de funcionamento.
- Suspensão seletiva de empréstimos, reservas ou acesso digital.
- Durante suspensão que impeça retirada, o prazo das reservas é pausado.
2.7 Obras digitais

- Arquivo hospedado ou link externo.
- Formatos hospedados: PDF e EPUB.
- Política de acesso por obra: pública ou restrita a leitores autenticados.
- Modo configurável por obra: leitura online, download ou ambos.
- Versão física e digital exibidas dentro do mesmo registro de obra.
2.8 Área privada do leitor

- Empréstimos ativos e vencimentos.
- Renovação quando elegível.
- Reservas ativas e filas com posição.
- Lista “Quero ler”.
- Histórico de empréstimos e devoluções.
- Marcação “Concluí a leitura”.
- Na devolução, pergunta sobre conclusão caso ainda não registrada.
- Indicadores pessoais: 
- livros emprestados no período;
- livros concluídos/devolvidos;
- categorias e temas mais lidos;
- obras diferentes concluídas;
- leituras concluídas, incluindo releituras;
- evolução mensal;
- avaliações realizadas;
- reservas e filas.
2.9 Avaliações

- Elegibilidade somente após empréstimo ou acesso digital.
- Uma avaliação por leitor e obra.
- Nota inteira de 1 a 5 estrelas.
- Pergunta “Recomendaria esta obra?” com resposta Sim/Não.
- Comentário opcional.
- Escolha de identificação ou anonimato.
- Nota e recomendação publicadas imediatamente.
- Comentário publicado somente após aprovação de administrador.
- Convite para avaliar imediatamente após “Concluí a leitura”.
- Avaliação voluntária e disponível apenas naquele momento; releitura oferece nova oportunidade de atualizar a avaliação.
- Exibição da média e número de avaliações.
- Exibição do percentual de recomendação e número de respostas.
- Sem denúncia de comentário no MVP.
2.10 Inventário

- Inventário programado ou extraordinário sob demanda.
- Leitura dos QR Codes por estante/prateleira.
- Classificação de exemplares como encontrados, emprestados, não encontrados ou localizados em posição divergente.
- Exemplar ausente marcado como “Não localizado no inventário”, sem mudança automática para perdido.
- Revisão das divergências pelo operador.
2.11 Comunicação

- E-mail e WhatsApp.
- Eventos obrigatórios do MVP: 
- confirmação de empréstimo;
- confirmação de devolução;
- reserva criada;
- disponibilidade para leitor da fila;
- proximidade do vencimento;
- renovação disponível;
- atraso;
- decisão sobre sugestão.
- Lembretes de atraso configuráveis, com padrão no 1º, 7º, 15º e 30º dia.
- Alerta operacional de atraso prolongado, configurável, com padrão de 30 dias.
- Registro do contato pessoal contendo data, operador, canal e observação.
- Retentativas automáticas de envio e opção de reenvio manual.
- Persistência de tentativa em canal com falha para comunicações críticas.
- Templates editáveis por administradores, com prévia, teste, histórico e restauração do padrão.
2.12 Administração e controles

- Dashboard operacional.
- Dashboard agregado de engajamento, sem exposição individual.
- Relatórios sob demanda com filtros.
- Exportação de relatórios em Excel/CSV e PDF.
- Moderação de comentários.
- Gestão de categorias principais pelo administrador.
- Criação de temas por operadores.
- Alerta de temas semelhantes.
- Mesclagem de temas pelo administrador.
- Sinônimos e termos relacionados administrados pelo administrador.
- Página inicial configurável por seções e ordem.
- Banners/cards com imagem, título, texto, link e agendamento.
- Avisos operacionais temporários.
- Log central de auditoria consultável por administradores.
- Retenção do log configurável.
- Falhas funcionais visíveis ao administrador.
2.13 Migração

- Importação de acervo por Excel/CSV.
- Enriquecimento por ISBN.
- Mesma edição identificada automaticamente por ISBN idêntico.
- Revisão humana de casos sem ISBN, incompletos ou ambíguos.
- Importação de leitores existentes.
- Validação de e-mail no primeiro acesso.
- Importação de empréstimos ativos com datas originais.
- Importação seletiva de histórico antigo confiável.
- Preservação de cadastros incompletos, exigindo complementação no primeiro acesso.
- Lista operacional de cadastros incompletos.
2.14 Requisitos não funcionais do MVP

- Aplicação web responsiva para computador, tablet e celular.
- Operação exclusivamente online.
- Interface em português.
- Compatibilidade com câmera do dispositivo para QR Code.
- WCAG 2.2 nível AA.
- Backup, restauração e observabilidade técnica sob responsabilidade da infraestrutura.
- Uma única unidade física.


3. Pós-MVP
Os itens abaixo fazem parte da visão do produto, mas não devem bloquear a primeira operação funcional.
3.1 Descoberta avançada

- Busca semântica em linguagem natural.
- Recomendações personalizadas combinando interesses, histórico, “Quero ler” e avaliações.
- Recomendações agregadas do tipo “Leitores desta obra também leram”.
- Mecanismo híbrido de obras relacionadas, com sugestão automática e curadoria manual.
- Páginas completas de autores, autores espirituais e psicógrafos, com biografia e imagem.
- Séries/coleções com ordem editorial e sequência recomendada de leitura.
3.2 Engajamento

- Conquistas padrão e personalizadas.
- Critérios por leituras totais ou obras distintas.
- Compartilhamento externo de conquistas.
- Campanhas de leitura com inscrição explícita.
- Critérios de campanha configuráveis: 
- todas as obras;
- quantidade mínima;
- obrigatórias + opcionais.
- Progresso individual privado e resultados coletivos agregados.
- Curadorias/listas temáticas administradas pela biblioteca.
- Sugestões de obras, exemplares e listas pelos leitores.
3.3 Experiência editorial

- Vitrine personalizada para leitores autenticados.
- Destaques editoriais avançados.
- Recomendações por faixa etária e nível de conhecimento.
- Compartilhamento facilitado de obras pelo WhatsApp.
3.4 Capacidades futuras deliberadamente excluídas

- Aplicativo nativo Android/iOS.
- Operação offline.
- Múltiplas unidades físicas.
- Fóruns, chats ou grupos de discussão.
- Ranking público de leitores.
- Controle de consulta local na estante.
- Programação e distribuição automática de relatórios.
- Workflow detalhado de manutenção/reparo.
- Controle de doações de livros.


4. Regras de negócio
RN-01 — Cadastro
Qualquer pessoa pode se cadastrar como leitor. A conta só é ativada após validação do e-mail.
RN-02 — Identidade
Autenticação e autorização são gerenciadas pelo Keycloak. A aplicação aplica os perfis recebidos.
RN-03 — Limite de circulação
A soma de empréstimos ativos e reservas ativas não pode ultrapassar 2 por leitor.
RN-04 — Mesma obra
Um leitor não pode ter simultaneamente mais de um empréstimo/reserva da mesma obra nem entrar em sua fila, ainda que as edições sejam diferentes.
RN-05 — Empréstimo
O prazo padrão é de 30 dias corridos, ajustado para o próximo período de funcionamento se o vencimento cair durante fechamento.
RN-06 — Renovação
É permitida uma única renovação de mais 30 dias, disponível nos últimos 7 dias do prazo original. A existência de fila não impede a renovação.
RN-07 — Atraso
Atraso não bloqueia automaticamente empréstimos ou reservas. O tratamento é educativo, com lembretes e escalonamento humano.
RN-08 — Reserva
Reserva de exemplar disponível vale por 24 horas de funcionamento da biblioteca.
RN-09 — Fila
A fila segue a ordem de solicitação e a preferência por qualquer edição ou edição específica.
RN-10 — Elegibilidade na fila
Leitor no limite de circulação é temporariamente ignorado, mantém sua posição e volta a ser avaliado em disponibilidade futura.
RN-11 — Expiração/cancelamento
Reserva da fila expirada ou cancelada encerra a participação do leitor naquela fila. O exemplar é oferecido ao próximo elegível.
RN-12 — Devolução
A leitura do QR Code registra a devolução. O operador pode alterar a condição antes de disponibilizar novamente o exemplar.
RN-13 — Exemplar danificado
Dano não gera obrigação automática ao leitor. O exemplar pode seguir para manutenção e retornar a Disponível.
RN-14 — Perda
Perda confirmada altera o exemplar para Perdido/extraviado. Pode ser registrado compromisso de reposição pela mesma obra, ainda que em edição diferente.
RN-15 — Baixa
Operador pode baixar exemplar, com motivo obrigatório, confirmação e auditoria.
RN-16 — Conclusão
Devolução não equivale automaticamente a leitura concluída. A conclusão depende de confirmação explícita do leitor.
RN-17 — Releitura
Uma mesma obra pode ser concluída várias vezes. O sistema distingue obras distintas de leituras concluídas.
RN-18 — Avaliação
Somente leitor com empréstimo ou acesso digital pode avaliar. Existe uma avaliação vigente por leitor e obra.
RN-19 — Moderação
Somente o texto do comentário exige aprovação. Nota e recomendação afetam os agregados imediatamente.
RN-20 — Privacidade
Dashboards administrativos de engajamento apresentam somente dados agregados. Indicadores individuais ficam na área privada do leitor.
RN-21 — Exclusão de conta
A solicitação remove ou anonimiza dados pessoais quando possível, preservando registros operacionais indispensáveis.
RN-22 — Obra digital
Cada edição digital define se o acesso é público/restrito e se permite leitura, download ou ambos.
RN-23 — Inventário
Ausência em inventário não torna automaticamente o exemplar perdido. O estado intermediário é “Não localizado no inventário”.
RN-24 — Suspensão
Quando a biblioteca suspender retiradas, prazos de reservas afetadas ficam pausados.
RN-25 — Auditoria
Toda ação sensível deve registrar usuário, data/hora, entidade, operação e valores relevantes antes/depois.


5. Modelo de dados conceitual
5.1 Núcleo bibliográfico
Obra

- id
- título
- sinopse
- categoriaPrincipalId
- faixaEtaria
- nivelConhecimento opcional
- statusPublicação
- dataCadastro
- dataAtualização
Edição

- id
- obraId
- editoraId
- anoPublicação
- descriçãoEdição
- ISBN opcional
- capa
- idioma
Exemplar

- id
- ediçãoId
- códigoQr
- estado
- estanteId
- prateleiraId
- motivoBaixa opcional
- dataCadastro
Pessoa bibliográfica

- id
- nome
- biografia opcional
- imagem opcional
Crédito da obra

- obraId
- pessoaBibliográficaId
- papel: AUTOR | AUTOR_ESPIRITUAL | PSICÓGRAFO | OUTRO
Categoria

- id
- nome
- descrição
- ativo
Tema

- id
- nome
- ativo
ObraTema

- obraId
- temaId
SinônimoTema

- id
- temaId
- termo
Série/Coleção

- id
- nome
- descrição
ObraSérie

- obraId
- sérieId
- númeroVolume opcional
- ordemEditorial opcional
- ordemRecomendada opcional
5.2 Conteúdo digital
RecursoDigital

- id
- ediçãoId
- tipo: ARQUIVO | LINK
- formato: PDF | EPUB | LINK
- localização
- acesso: PÚBLICO | AUTENTICADO
- permiteLeituraOnline
- permiteDownload
- ativo
5.3 Pessoas e acesso
Leitor

- id
- keycloakUserId
- nomeCompleto
- telefone
- email
- dataNascimento
- númeroCarteirinha
- qrCarteirinha
- status
- emailValidado
- dadosCompletos
PreferênciaComunicação

- leitorId
- operacionalEmail
- operacionalWhatsApp
- engajamentoEmail
- engajamentoWhatsApp
InteresseLeitor

- leitorId
- temaId opcional
- pessoaBibliográficaId opcional
- nivelConhecimento opcional
5.4 Circulação
Empréstimo

- id
- leitorId
- exemplarId
- dataRetirada
- dataDevoluçãoPrevista
- dataDevoluçãoReal opcional
- renovado
- status
- operadorRetiradaId
- operadorDevoluçãoId opcional
Reserva

- id
- leitorId
- obraId
- ediçãoPreferidaId opcional
- exemplarId
- origem: DIRETA | FILA
- início
- expiração
- tempoPausado
- status
FilaEspera

- id
- leitorId
- obraId
- ediçãoPreferidaId opcional
- dataEntrada
- posiçãoLógica
- status
ContatoAtraso

- id
- empréstimoId
- operadorId
- dataHora
- canal
- observação
Reposição

- id
- empréstimoId
- compromissoRegistrado
- novaEdiçãoId opcional
- novoExemplarId opcional
- status
5.5 Jornada e comunidade
Leitura

- id
- leitorId
- obraId
- empréstimoId opcional
- recursoDigitalId opcional
- dataConclusão
- releitura
QueroLer

- leitorId
- obraId
- dataInclusão
Avaliação

- id
- leitorId
- obraId
- estrelas
- recomenda
- comentário opcional
- exibiçãoAnônima
- statusComentário
- dataAvaliação
- dataAtualização
ListaTemática

- id
- título
- descrição
- ativo
ListaObra

- listaId
- obraId
- ordem
Campanha

- id
- título
- descrição
- início
- fim
- regraConclusão
- conquistaId opcional
- status
CampanhaObra

- campanhaId
- obraId
- obrigatória
ParticipaçãoCampanha

- campanhaId
- leitorId
- dataInscrição
- status
- dataConclusão opcional
Conquista

- id
- nome
- descrição
- ícone
- origem: PADRÃO | PERSONALIZADA
- critérioTipo
- critérioConfiguração
- ativo
ConquistaLeitor

- conquistaId
- leitorId
- dataConquista
Sugestão

- id
- leitorId
- tipo
- conteúdo
- status: PENDENTE | APROVADA | REJEITADA
- comentárioAdministrador opcional
5.6 Operação
Estante

- id
- nome
- ativo
Prateleira

- id
- estanteId
- nome
- ativo
Inventário

- id
- tipo: PROGRAMADO | EXTRAORDINÁRIO
- início
- fim opcional
- status
- responsávelId
ItemInventário

- inventárioId
- exemplarId
- resultado
- localizaçãoEncontrada opcional
CalendárioFuncionamento

- id
- diaSemana
- abertura
- fechamento
ExceçãoCalendário

- id
- data
- tipo
- abertura opcional
- fechamento opcional
- descrição
Notificação

- id
- leitorId
- evento
- canal
- status
- tentativas
- dataEnvio opcional
- erro opcional
TemplateNotificação

- id
- evento
- canal
- versão
- conteúdo
- ativo
Auditoria

- id
- usuárioId
- dataHora
- entidade
- entidadeId
- operação
- antes opcional
- depois opcional


6. Jornadas principais
J01 — Descobrir e reservar uma obra

1. Visitante acessa o catálogo público.
2. Pesquisa por título, autor, tema, ISBN ou intenção.
3. Aplica filtros e ordenação.
4. Abre a página da obra.
5. Consulta edições, disponibilidade, localização e avaliações.
6. Seleciona qualquer edição ou uma edição específica.
7. Autentica-se, se necessário.
8. Sistema valida limite e duplicidade da obra.
9. Reserva exemplar por 24 horas de funcionamento.
10. Sistema envia confirmação por e-mail e WhatsApp conforme preferências.
J02 — Entrar e avançar em fila

1. Leitor encontra obra sem exemplares disponíveis.
2. Escolhe qualquer edição ou edição específica.
3. Entra na fila.
4. Acompanha posição na área privada.
5. Na devolução de exemplar compatível, sistema procura o primeiro elegível.
6. Sistema cria reserva automática e notifica o leitor.
7. O leitor retira, cancela ou deixa a reserva expirar.
8. Cancelamento/expiração encerra sua participação e aciona o próximo elegível.
J03 — Empréstimo presencial

1. Operador localiza leitor por nome/e-mail ou escaneia carteirinha.
2. Sistema exibe empréstimos, reservas, atrasos e limite disponível.
3. Operador escaneia QR Code do exemplar.
4. Sistema valida estado, limite e duplicidade da obra.
5. Operador confirma.
6. Sistema cria empréstimo e calcula vencimento.
7. Exemplar muda para Emprestado.
8. Comprovante é enviado.
J04 — Devolução

1. Operador escaneia QR Code.
2. Sistema localiza empréstimo ativo.
3. Operador informa condição do exemplar.
4. Sistema registra devolução.
5. Se houver dano, operador escolhe Danificado ou Em manutenção/reparo.
6. Se estiver apto, sistema aciona fila ou marca Disponível.
7. Sistema pergunta se a leitura foi concluída, quando necessário.
8. Confirmação é enviada ao leitor.
J05 — Renovação

1. Nos últimos 7 dias, leitor recebe lembrete com link.
2. Acessa o empréstimo.
3. Sistema valida se renovação ainda não foi usada.
4. Calcula mais 30 dias e ajusta ao calendário.
5. Confirma renovação e atualiza vencimento.
J06 — Concluir e avaliar

1. Leitor seleciona “Concluí a leitura” ou confirma na devolução.
2. Sistema registra uma nova Leitura.
3. Atualiza indicadores e conquistas.
4. Exibe convite de avaliação.
5. Leitor avalia ou escolhe não avaliar.
6. Nota e recomendação são publicadas.
7. Comentário, se houver, segue para moderação.
J07 — Cadastrar acervo

1. Operador informa ISBN ou escolhe cadastro manual.
2. Sistema sugere metadados e capa quando possível.
3. Operador revisa Obra e Edição.
4. Associa categoria, temas, público, nível e créditos.
5. Cadastra exemplares e localizações.
6. Sistema gera QR Codes.
7. Operador imprime etiquetas individualmente ou em lote.
J08 — Inventariar acervo

1. Operador inicia inventário programado ou extraordinário.
2. Seleciona estante/prateleira.
3. Escaneia exemplares.
4. Sistema registra localização encontrada.
5. Ao finalizar, gera divergências.
6. Itens ausentes ficam como “Não localizado no inventário”.
7. Operador investiga e resolve cada divergência.
J09 — Migração inicial

1. Administrador envia Excel/CSV.
2. Sistema valida estrutura e dados.
3. Agrupa edições por ISBN idêntico.
4. Sinaliza ambiguidades.
5. Operador revisa e confirma.
6. Sistema importa obras, edições, exemplares, leitores e empréstimos ativos.
7. Gera QR Codes e lista de cadastros incompletos.


7. Histórias de usuário e critérios de aceite
Épico A — Cadastro e identidade
US-A01 — Autocadastro
Como visitante, quero criar minha conta, para reservar livros e acompanhar minha jornada.
Critérios de aceite

- Dado um e-mail ainda não utilizado, quando o visitante concluir o cadastro, então a conta deve permanecer pendente até a validação do e-mail.
- Após validação, o perfil Schutelista (recebido pelo grupo padrão do realm) passa a valer na biblioteca.
- Nome completo, telefone/WhatsApp, e-mail e data de nascimento devem ser armazenados.
- O leitor deve poder definir preferências de canal e finalidade.
US-A02 — Carteirinha digital
Como leitor, quero exibir uma carteirinha digital, para ser identificado rapidamente no balcão.
Critérios de aceite

- A carteirinha deve exibir nome, número legível e QR Code pessoal.
- Ao escanear o QR Code, o operador deve localizar o leitor correto.
- O código não deve expor dados pessoais diretamente.
Épico B — Catálogo
US-B01 — Pesquisa
Como visitante, quero pesquisar o acervo, para encontrar obras relevantes.
Critérios de aceite

- A busca deve consultar título, autoria, ISBN, categoria, temas e sinopse.
- O catálogo deve estar disponível sem autenticação.
- Resultados devem permitir filtros e ordenação.
- Cada resultado deve informar formato e disponibilidade.
US-B02 — Detalhes da obra
Como leitor, quero compreender uma obra e suas opções de acesso, para decidir como lê-la.
Critérios de aceite

- A página deve consolidar as edições sob uma única obra.
- Deve apresentar versões físicas e digitais.
- Exemplares disponíveis devem mostrar estante e prateleira.
- Nota média deve ser acompanhada do número de avaliações.
- Percentual de recomendação deve ser acompanhado do número de respostas.
Épico C — Reserva e fila
US-C01 — Reservar exemplar
Como leitor, quero reservar um exemplar disponível, para retirá-lo posteriormente.
Critérios de aceite

- O leitor deve escolher qualquer edição ou uma edição específica.
- A soma de empréstimos e reservas não pode ultrapassar 2.
- Não deve ser possível reservar a mesma obra já emprestada ou reservada.
- A reserva deve expirar após 24 horas de funcionamento.
- Uma confirmação deve ser registrada e enviada pelos canais habilitados.
US-C02 — Entrar na fila
Como leitor, quero entrar numa fila, para ser avisado quando a obra estiver disponível.
Critérios de aceite

- A fila deve preservar a ordem de entrada.
- O leitor deve visualizar sua posição.
- O leitor pode sair da fila.
- Ao haver disponibilidade, o sistema deve reservar automaticamente para o primeiro elegível.
- O leitor no limite deve manter sua posição, mas ser ignorado naquela disponibilidade.
Épico D — Empréstimo e devolução
US-D01 — Registrar empréstimo
Como operador, quero identificar o leitor e escanear exemplares, para registrar o empréstimo com rapidez.
Critérios de aceite

- O sistema deve validar estado do exemplar, limite do leitor e duplicidade da obra.
- Deve calcular 30 dias e ajustar a data ao calendário.
- Deve mudar o estado para Emprestado.
- Deve registrar operador, data e hora.
- Deve enviar comprovante.
US-D02 — Registrar devolução
Como operador, quero escanear o exemplar devolvido, para encerrar o empréstimo e atualizar o acervo.
Critérios de aceite

- O sistema deve localizar o empréstimo ativo pelo QR Code.
- O operador deve poder informar condição do exemplar.
- Exemplar apto deve acionar a fila ou ficar Disponível.
- O evento deve ser auditado.
- O leitor deve receber confirmação.
US-D03 — Renovar empréstimo
Como leitor, quero renovar uma vez nos últimos 7 dias, para concluir minha leitura.
Critérios de aceite

- A renovação só deve aparecer nos últimos 7 dias do período original.
- Deve ser bloqueada se já utilizada.
- Deve adicionar 30 dias e respeitar o calendário.
- Fila existente não deve impedir a renovação.
Épico E — Acervo
US-E01 — Cadastrar por ISBN
Como operador, quero informar o ISBN e receber uma sugestão de metadados, para reduzir o esforço de catalogação.
Critérios de aceite

- Dados externos nunca devem ser salvos sem revisão.
- O operador deve poder corrigir todos os campos.
- ISBN idêntico deve sugerir associação a edição existente.
- Ausência de resultado deve permitir cadastro manual.
US-E02 — Gerar etiquetas
Como operador, quero imprimir QR Codes individualmente ou em lote, para identificar o acervo físico.
Critérios de aceite

- Cada exemplar deve ter QR Code único.
- A leitura deve recuperar exatamente um exemplar.
- Deve ser possível gerar uma folha com múltiplas etiquetas.
Épico F — Inventário
US-F01 — Executar inventário
Como operador, quero escanear os livros por localização, para conferir o acervo.
Critérios de aceite

- O inventário deve aceitar leituras sucessivas de QR Code.
- Deve comparar localização esperada e encontrada.
- Um exemplar não lido não pode ser automaticamente marcado como perdido.
- Divergências devem permanecer pendentes de revisão.
Épico G — Jornada de leitura
US-G01 — Marcar conclusão
Como leitor, quero marcar que concluí uma obra, para acompanhar minha jornada.
Critérios de aceite

- Devolução isolada não deve criar conclusão.
- Cada conclusão deve criar um registro de Leitura.
- Releituras devem incrementar leituras totais, mas não obras distintas.
- Indicadores pessoais devem ser atualizados.
US-G02 — Avaliar obra
Como leitor elegível, quero avaliar a obra ao concluir a leitura, para contribuir com a comunidade.
Critérios de aceite

- A avaliação deve ser opcional.
- Estrelas devem aceitar inteiros de 1 a 5.
- A recomendação deve aceitar Sim ou Não.
- Comentário deve ser opcional.
- Comentário deve aguardar moderação.
- Deve existir uma única avaliação vigente por leitor e obra.
Épico H — Comunicação
US-H01 — Receber lembrete
Como leitor, quero receber lembretes pelos canais escolhidos, para devolver ou renovar no prazo.
Critérios de aceite

- O lembrete dos últimos 7 dias deve incluir link de renovação quando elegível.
- Atrasos devem seguir a cadência configurada.
- Falhas devem gerar retentativas.
- Falha persistente de evento crítico deve gerar pendência operacional.
Épico I — Administração
US-I01 — Moderar comentários
Como administrador, quero aprovar ou rejeitar comentários, para manter a qualidade do catálogo.
Critérios de aceite

- Comentário pendente não deve aparecer publicamente.
- Nota e recomendação devem permanecer válidas independentemente da decisão textual.
- Aprovação/rejeição deve ser auditada.
US-I02 — Consultar dashboards
Como administrador, quero separar operação de engajamento, para acompanhar saúde da biblioteca e incentivo à leitura.
Critérios de aceite

- Painel operacional deve exibir acervo, empréstimos, reservas, atrasos e pendências.
- Painel de engajamento deve usar apenas dados agregados.
- Nenhum hábito individual deve ser exposto no painel agregado.


8. Critérios globais de aceite do MVP
O MVP estará apto para implantação quando:

1. Um novo leitor conseguir se cadastrar, validar o e-mail e acessar sua área privada.
2. Um operador conseguir cadastrar uma obra, edição e exemplar, gerar QR Code e definir localização.
3. Um visitante conseguir localizar a obra no catálogo público.
4. Um leitor autenticado conseguir reservar um exemplar ou entrar numa fila.
5. Um operador conseguir concluir empréstimo e devolução por QR Code.
6. Limites, duplicidades, prazos, renovações e calendário forem aplicados automaticamente.
7. E-mail e WhatsApp registrarem envios, falhas e retentativas.
8. O leitor conseguir acompanhar empréstimos, reservas, filas e histórico.
9. Um inventário conseguir identificar divergências sem alterar automaticamente para perdido.
10. Comentários dependerem de moderação e os dashboards preservarem a privacidade individual.
11. As ações sensíveis estiverem registradas no log de auditoria.
12. As jornadas essenciais forem utilizáveis em celular e computador e atenderem WCAG 2.2 AA.
13. A migração por Excel/CSV conseguir importar um conjunto validado de obras, exemplares, leitores e empréstimos ativos.


9. Fora de escopo explícito

- Controle de doações de livros.
- Venda de livros ou produtos.
- Controle financeiro.
- Multas por atraso.
- Bloqueio automático por atraso.
- Fóruns e mensagens entre leitores.
- Ranking público.
- Aplicativo nativo.
- Modo offline.
- Múltiplas bibliotecas físicas.
- Controle de presença ou consulta local.
- Gestão técnica de backup e observabilidade dentro da aplicação.


10. Métricas de sucesso
Operacionais

- Percentual de empréstimos registrados por QR Code.
- Tempo entre identificação do leitor e confirmação do empréstimo.
- Percentual de exemplares com localização válida.
- Divergências por inventário.
- Taxa de notificações críticas entregues.
- Empréstimos em atraso e tempo médio de atraso.
Adoção

- Leitores cadastrados e validados.
- Leitores ativos no período.
- Buscas que resultam em visualização de obra.
- Visualizações que resultam em reserva, fila ou acesso digital.
Fomento à leitura

- Leituras concluídas.
- Obras distintas concluídas.
- Participação em campanhas.
- Diversidade de categorias e temas lidos.
- Avaliações realizadas.
- Uso das listas temáticas e recomendações.
Todas as métricas administrativas de leitura devem ser apresentadas de forma agregada.
