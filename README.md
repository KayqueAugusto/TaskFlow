# TaskFlow — Vue 3 + API em preparação

Aplicação de gestão de tarefas, projetos, equipes e workspaces. A interface aprovada permanece em Vue 3; a primeira fundação de servidor e banco foi adicionada sem conectar os fluxos de negócio locais à API antes de existirem autenticação e autorização reais.

## Estado real

- **Implementado e integrado:** interface responsiva, navegação, Pinia, persistência local compatível, adaptador versionado de armazenamento, endpoint `GET /api/health`, contratos iniciais, schema/migration/seed PostgreSQL e testes da fundação.
- **Parcialmente implementado:** API (infraestrutura e health, sem endpoints de negócio), banco (artefatos prontos, sem instância aplicada neste ambiente) e separação da camada de dados.
- **Simulado no frontend:** login/cadastro local, sessão e permissões client-side, contas demo, workspaces, convites, projetos, tarefas, membros, notificações e perfil.
- **Não implementado:** autenticação e autorização reais, integração web/API, OAuth Google, e-mail, recuperação de senha, upload externo e E2E.

Nenhum fluxo local deve ser interpretado como segurança de produção. As senhas em texto puro existem apenas no adaptador legado do protótipo; o seed do futuro banco usa bcrypt.

## Stack

- Web: Vue 3, Composition API, TypeScript, Vite, Vue Router, Pinia, Lucide Vue e CSS próprio.
- API preparada: Node.js, TypeScript, Fastify, Zod, CORS e rate limiting.
- Dados preparados: PostgreSQL e Prisma ORM.
- Qualidade: ESLint, vue-tsc, TypeScript, Vitest e injeção Fastify para testes HTTP.

Fastify foi escolhido por tipagem, baixo overhead e teste HTTP sem abrir porta. Prisma foi escolhido por migrations legíveis, relações e client tipado. Essa fundação não autoriza o frontend a confiar no backend até endpoints com sessão e autorização por membership serem implementados.

## Estrutura

```text
src/
  components/       interface preservada
  domain/           modelos e seeds locais
  services/         armazenamento e contratos de fonte de dados
  stores/           estado Pinia
  views/             rotas visuais
server/              bootstrap e infraestrutura Fastify
prisma/              schema, migration inicial e seed
tests/               testes da fundação
docs/ARCHITECTURE.md decisões e plano de migração
```

## Requisitos e instalação

- Node.js `>=22.13.0`
- pnpm `11.25.0`
- Docker Desktop (recomendado) ou PostgreSQL para aplicar migration/seed

```bash
pnpm install
```

O ambiente desta auditoria tinha Node 22.12.0; os comandos funcionaram com aviso, mas a versão declarada deve ser respeitada em desenvolvimento e CI.

## Configuração

Copie `.env.example` para `.env` e ajuste somente valores locais. Nunca versione `.env` ou segredos.

```env
DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow
API_HOST=127.0.0.1
API_PORT=3001
WEB_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3001/api
```

## PostgreSQL local

```bash
docker compose up -d
pnpm prisma:migrate
pnpm prisma:seed
```

O volume `taskflow_postgres_data` é persistente e o healthcheck aguarda o banco ficar pronto. As credenciais do compose são exclusivas de desenvolvimento.

## Execução

```bash
pnpm dev:web
pnpm dev:api
```

`pnpm dev` continua iniciando apenas o frontend, preservando o fluxo anterior. A API oferece somente `GET /api/health`; a UI ainda usa o adaptador local.

## Banco, migration e seed

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

O schema cobre usuários, credenciais, perfis, workspaces, memberships, papéis/bloqueio, convites, projetos, tarefas, responsáveis, comentários, atividades, notificações, preferências e sessões revogáveis. A primeira migration está em `prisma/migrations/20260915000100_initial/`.

Contas locais e de seed de desenvolvimento:

| Perfil | E-mail | Senha de desenvolvimento |
| --- | --- | --- |
| Administrador | `kayque@taskflow.demo` | `123456` |
| Membro | `marina@taskflow.demo` | `123456` |

Não reutilize essas credenciais em produção.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

`pnpm test:integration` executa o teste com PostgreSQL real quando `DATABASE_URL_TEST` estiver definido para um banco separado cujo nome contenha `test`; sem essa variável o caso fica explicitamente marcado como skipped.

## Rotas atuais

`/login`, `/cadastro`, `/dashboard`, `/tarefas`, `/projetos`, `/projetos/:id`, `/calendario`, `/equipe`, `/equipe/:id/atividades`, `/relatorios` e `/configuracoes`.

## Persistência e compatibilidade

O adaptador mantém as chaves legadas `taskflow_session`, `taskflow_accounts`, `taskflow_workspaces`, `taskflow_memberships`, `taskflow_invites`, `taskflow_tasks_{workspaceId}`, `taskflow_projects_{workspaceId}`, `taskflow_members_{workspaceId}`, `taskflow_prefs_{accountId}` e `taskflow_remember_email`. Novas gravações registram `taskflow_storage_version=1`. JSON inválido é ignorado com fallback, sem remoção automática.

Dados de negócio não são importados automaticamente para o PostgreSQL. A estratégia recomendada é criar um importador explícito e idempotente depois que autenticação e endpoints existirem; até lá não há duplicação silenciosa entre navegador e banco.

Consulte [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) para riscos e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para decisões.

## Atualização de autenticação (2026-09-16)

Login, cadastro, logout, recuperação de sessão (`GET /api/auth/me`) e atualização básica de perfil usam agora a API real. A sessão usa cookie HttpOnly persistido no banco, com expiração de sete dias e revogação no logout; nenhum token de autenticação é gravado no `localStorage`. O frontend mantém apenas um contexto local transitório para que projetos/tarefas legados continuem funcionando.

Para PostgreSQL local, execute `docker compose up -d`, `pnpm prisma:migrate` e `pnpm prisma:seed`. O PostgreSQL do Compose usa `localhost:5433` e nunca interfere no serviço Windows em `localhost:5432`. O script de inicialização cria `taskflow_test` de forma idempotente.

O `.env` local usa `DATABASE_URL` em `5433` e `DATABASE_URL_TEST` em `5433/taskflow_test`; ele é ignorado pelo Git. O arquivo `.env.example` contém apenas credenciais de desenvolvimento.
