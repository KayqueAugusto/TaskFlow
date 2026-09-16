# Arquitetura e decisões

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

1. Repositórios Prisma, autenticação, cookies e autorização por workspace.
2. Workspaces/memberships/convites, incluindo último admin e bloqueio.
3. Projetos e tarefas com integração incremental da UI.
4. Perfil e armazenamento externo de imagens.
5. Complementares, integração E2E e observabilidade.
