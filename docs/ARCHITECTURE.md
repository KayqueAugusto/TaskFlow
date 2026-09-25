# Arquitetura e decisões

## Integração final do domínio — 2026-09-25

`BusinessService` implementa projetos, tarefas, responsáveis e atividades sobre Prisma. Toda consulta começa pela membership ativa e inclui `workspaceId`; IDs de projeto, tarefa e usuário nunca autorizam acesso isoladamente. OWNER e ADMIN administram projetos e tarefas. MEMBER pode criar tarefas e alterar título, descrição ou status de tarefas criadas por ele ou atribuídas a ele. Responsáveis e participantes são usuários com membership ativa no mesmo workspace.

`useBusinessStore` é a fonte de projetos, tarefas e atividades no cliente. Ela carrega os três conjuntos em paralelo, usa um contador de versão para descartar respostas do workspace anterior e recalcula Dashboard, calendário, progresso e relatórios a partir das mesmas coleções. A store legada conserva somente a projeção de sessão/membros necessária aos componentes e preferências visuais. Chaves antigas de projeto/tarefa permanecem intactas como backup, sem leitura, escrita dupla ou importação automática.

Datas de prazo são transmitidas como `YYYY-MM-DD`, armazenadas em UTC à meia-noite e devolvidas novamente como data civil. O calendário compara a string civil construída no fuso local, evitando deslocamento de dia. Exclusão de projeto falha com `409` quando há tarefas. A migration `20260925120500_projects_tasks_api` adiciona status do projeto, participantes e `completedAt`.

## Integração de workspaces e membros — 2026-09-18

`WorkspaceService` consulta memberships PostgreSQL a partir da identidade da sessão. Cada leitura e mutação verifica membership ativa no servidor; bloqueio impede acesso ao workspace sem encerrar a conta pessoal. `OWNER` pode transferir propriedade em transação; `ADMIN` gerencia apenas membros comuns; `MEMBER` apenas consulta. Perfil pessoal e função no workspace são campos distintos. Exclusão de workspace retorna `409` até migrar projetos/tarefas e definir a política de dados relacionados.

Convites persistem hash SHA-256 de token aleatório de 32 bytes, e-mail de destino, papel, expiração e estado. Aceitação autenticada verifica e-mail e cria membership em transação; o link usa `WEB_ORIGIN`. O servidor não envia e-mail. A store `workspaces` busca lista, membros e convites da API e conserva apenas o ID selecionado no navegador. A store legada continua servindo projetos/tarefas locais, projetando membros reais para os componentes existentes. A próxima fase deve migrar projetos/tarefas e remover essa ponte.

Migration nova: `20260918010438_workspace_member_roles_and_invitation_lifecycle`. A migration preexistente `20260917023523_pnpm_prisma_seed` permanece intocada: ajusta ações de exclusão de chaves estrangeiras e cria índices `Workspace_ownerId_idx` e `Comment_taskId_createdAt_idx`.

## Baseline auditada em 2026-09-15

O frontend é uma SPA Vue 3 compacta. `WorkspaceView` orquestra páginas e modais, enquanto a store Pinia mantém todo o domínio. Antes desta entrega, store, router e login acessavam `localStorage` diretamente; modelos, seeds, autenticação local e regras também viviam na store. Não havia backend, banco ou testes.

## Decisões desta fase

1. **Evolução no mesmo repositório sem mover o frontend.** Uma migração imediata para `apps/web` criaria churn e risco visual sem benefício funcional.
2. **Fronteira de dados antes da integração.** `src/services/data-source.ts` define o contrato que permitirá trocar o adaptador local por API gradualmente. `src/services/storage.ts` centraliza e versiona as chaves existentes.
3. **Fastify + Zod.** Fastify oferece lifecycle pequeno, tipagem e `inject` para integração. Zod validará fronteiras HTTP e ambiente. Express não adicionaria benefício específico nesta escala.
4. **PostgreSQL + Prisma.** O domínio é relacional e exige constraints, transações, índices e isolamento de workspace. Prisma mantém schema e client tipados. IDs novos serão UUIDs de servidor.
5. **Sessões persistidas e revogáveis.** O schema armazena apenas hash do token e expiração. A política de cookie HTTP-only, secure, same-site e CSRF será fechada junto aos endpoints de autenticação.
6. **bcrypt para credenciais.** Argon2 foi tentado, mas o pacote nativo exigiu toolchain C++ ausente no Windows auditado. `bcryptjs` com custo 12 mantém instalação portátil; a decisão pode ser revisitada no deploy.

## Limite de segurança atual

A API não recebe identidade nem oferece endpoints de negócio. Portanto não existe falsa autorização server-side. Quando implementados, todos os queries deverão conter `workspaceId` derivado de uma sessão válida e membership ativa; IDs vindos da URL nunca bastarão. Operações administrativas deverão proteger proprietário e último administrador dentro de transações.

## Migração localStorage → API

1. Manter chaves antigas legíveis e registrar versão sem apagar dados.
2. Implementar sessão real e endpoint de identidade.
3. Implementar leitura/escrita de um agregado por vez atrás de `TaskFlowDataSource`.
4. Oferecer importação explícita, validada e idempotente dos dados locais ou reinicialização confirmada.
5. Após confirmação do servidor, remover somente dados de negócio; manter tema, modo compacto e e-mail lembrado localmente quando apropriado.

Não haverá sincronização bidirecional: ela produziria conflitos e duplicação entre duas fontes de verdade.

## Fases seguintes

## Autenticação vertical

`AuthService` separa validação, hash, criação/consulta/revogação de sessões e serialização segura do usuário. `PrismaAuthRepository` usa transação no cadastro para criar usuário, credencial, perfil, preferências, workspace e membership OWNER. `InMemoryAuthRepository` existe apenas para testes isolados. O cookie `taskflow_session` é HttpOnly; somente seu hash é persistido.

O router consulta `/auth/me` no primeiro guard e o App inicializa o `AuthStore`. A store de domínio recebe apenas o usuário seguro para criar um contexto local transitório; ela não decide se a sessão é válida. Ao migrar projetos/tarefas, esse bridge deverá ser removido.

## PostgreSQL local isolado

O Compose publica `5433:5432`, mantendo o serviço PostgreSQL Windows em `5432` completamente fora do fluxo. O volume `taskflow_postgres_data` é persistente. O script `docker/postgres/init/01-create-test-db.sh` cria `taskflow_test` apenas na inicialização do volume e é idempotente; migrations continuam sendo a fonte versionada do schema. Neste ambiente Docker não está instalado, portanto a execução do Compose e a migration real permanecem pendentes.

1. Repositórios Prisma, autenticação, cookies e autorização por workspace.
2. Workspaces/memberships/convites, incluindo último admin e bloqueio.
3. Projetos e tarefas com integração incremental da UI.
4. Perfil e armazenamento externo de imagens.
5. Complementares, integração E2E e observabilidade.
