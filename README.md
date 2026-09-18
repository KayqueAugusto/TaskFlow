# TaskFlow — Vue 3 + Fastify + PostgreSQL

Aplicação de gestão de tarefas, projetos, equipes e workspaces. Autenticação, workspaces, memberships e convites usam Fastify, Prisma e PostgreSQL; a interface Vue aprovada permanece.

## Estado real

- **Integrado:** cadastro, login, sessão, perfil, logout, workspaces, membros, papéis, bloqueio, transferência de propriedade e convites persistidos. A API autoriza cada operação pela membership ativa.
- **Local:** projetos, tarefas, calendário, relatórios derivados, preferências visuais e notificações de tarefas. O ID do workspace ativo é apenas uma preferência local validada pela API.
- **Pendente:** envio de e-mail, OAuth Google, recuperação de senha, upload externo e migração de projetos/tarefas.

Projetos e tarefas locais ainda não são colaboração entre dispositivos. O servidor é a fonte de verdade para identidade, workspaces, membros e convites.

## Stack

- Web: Vue 3, Composition API, TypeScript, Vite, Vue Router, Pinia, Lucide Vue e CSS próprio.
- API: Node.js, TypeScript, Fastify, Zod, CORS e rate limiting.
- Dados: PostgreSQL e Prisma ORM.
- Qualidade: ESLint, vue-tsc, TypeScript, Vitest e injeção Fastify para testes HTTP.

Fastify permite testes HTTP sem abrir porta; Prisma mantém migrations e relações tipadas. A autorização é verificada no servidor.

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

Use a versão de Node indicada em `package.json`.

## Configuração

Copie `.env.example` para `.env` e ajuste somente valores locais. Nunca versione `.env` ou segredos.

```env
DATABASE_URL=postgresql://taskflow:taskflow_dev_only@localhost:5433/taskflow
DATABASE_URL_TEST=postgresql://taskflow:taskflow_dev_only@localhost:5433/taskflow_test
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

`pnpm dev` inicia apenas o frontend. Execute a API em outro terminal para os fluxos integrados.

## Banco, migration e seed

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

O schema cobre usuários, perfis, workspaces, memberships, convites, projetos/tarefas futuros e sessões. A migration `20260918010438_workspace_member_roles_and_invitation_lifecycle` adiciona função específica da membership e estado de convite revogado. A migration preexistente `20260917023523_pnpm_prisma_seed` foi preservada sem alteração; seu SQL recria regras de cascata de chaves estrangeiras e adiciona índices para proprietário de workspace e comentários.

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

`/login`, `/cadastro`, `/invite/:token`, `/dashboard`, `/tarefas`, `/projetos`, `/projetos/:id`, `/calendario`, `/equipe`, `/equipe/:id/atividades`, `/relatorios` e `/configuracoes`.

## Persistência e compatibilidade

O adaptador ainda lê chaves legadas para projetos/tarefas, mas workspaces, memberships e convites não são mais gravados nele. `taskflow_active_workspace_id` guarda apenas a preferência de seleção, sempre validada pelo servidor. Dados locais antigos não são importados automaticamente.

Exclusão de workspace está indisponível (`409`) até existir uma política segura para projetos/tarefas. Convites geram links copiáveis, sem envio de e-mail. Próxima fase: migrar projetos, tarefas e seus relacionamentos para o PostgreSQL.

Consulte [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) para riscos e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para decisões.

## Atualização de autenticação (2026-09-16)

Login, cadastro, logout, recuperação de sessão (`GET /api/auth/me`) e atualização básica de perfil usam agora a API real. A sessão usa cookie HttpOnly persistido no banco, com expiração de sete dias e revogação no logout; nenhum token de autenticação é gravado no `localStorage`. O frontend mantém apenas um contexto local transitório para que projetos/tarefas legados continuem funcionando.

Para PostgreSQL local, execute `docker compose up -d`, `pnpm prisma:migrate` e `pnpm prisma:seed`. O PostgreSQL do Compose usa `localhost:5433` e nunca interfere no serviço Windows em `localhost:5432`. O script de inicialização cria `taskflow_test` de forma idempotente.

O `.env` local usa `DATABASE_URL` em `5433` e `DATABASE_URL_TEST` em `5433/taskflow_test`; ele é ignorado pelo Git. O arquivo `.env.example` contém apenas credenciais de desenvolvimento.
