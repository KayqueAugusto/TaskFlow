# TaskFlow — Vue + Fastify + PostgreSQL

MVP de gestão de workspaces, equipes, projetos e tarefas. A publicação inicial usa **um Web Service no Render**, com Vue e API na mesma origem, e PostgreSQL gerenciado separado. Não há deploy externo automático nesta entrega.

## Stack e funcionalidades reais

Vue 3, TypeScript, Vite, Vue Router, Pinia e Lucide; Node.js/Fastify, Zod, Prisma 6 e PostgreSQL. ESLint, Vitest, integração PostgreSQL e Playwright validam a aplicação.

Persistidos no PostgreSQL: cadastro, login, sessões, perfil, workspaces, membros, permissões, bloqueio/remoção, transferência de propriedade, convites por link, projetos, tarefas, responsáveis e atividades. Dashboard, Minhas tarefas, Projetos, Calendário, Relatórios e Equipe consomem esses registros. Preferências visuais e seleção de workspace ficam no navegador; não autorizam acesso.

Fora do MVP: OAuth Google, recuperação de senha, envio de convite por e-mail, armazenamento externo de avatar, notificações em tempo real e política final de exclusão de workspace. A exclusão de workspace continua indisponível; projetos com tarefas não podem ser excluídos. Dados antigos do localStorage não são importados.

## Instalação e execução local

Requisitos: Node.js >=22.13, pnpm 11.25.0, Docker Desktop/Compose (ou PostgreSQL compatível).

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
docker compose up -d
pnpm prisma:generate
pnpm db:deploy
# Opcional, explícito:
pnpm prisma:seed
```

Compose publica PostgreSQL 16 em localhost:5433 e mantém volume persistente. A inicialização cria taskflow_test separado. Não use as credenciais do Compose em produção. Não execute testes destrutivos contra dados reais.

Em dois terminais:

```bash
pnpm dev:web
pnpm dev:api
```

Vite: http://localhost:5173; API: http://localhost:3001. A API carrega .env via Node. API_PORT e WEB_ORIGIN antigos são aceitos apenas como aliases locais; prefira PORT e APP_ORIGIN. O host local da API é 127.0.0.1.

## Variáveis de ambiente

| Variável | Produção | Desenvolvimento |
| --- | --- | --- |
| NODE_ENV | production (pnpm start força este modo) | development; test nos testes |
| PORT | Obrigatória; Render fornece | 3001 por padrão |
| DATABASE_URL | URL PostgreSQL privada, sem credenciais locais | Banco Compose |
| SESSION_SECRET | Obrigatória, aleatória, pelo menos 32 caracteres | Fallback público somente local |
| APP_ORIGIN | Origem HTTPS exata, ex.: https://taskflow-identificador.onrender.com | http://localhost:5173 |
| COOKIE_SECURE | true obrigatório | false |
| DATABASE_URL_TEST | Não configurar no Render | Banco separado cujo nome contenha test |
| VITE_API_URL | Não configurar: produção usa /api | URL local da API |

APP_ORIGIN não aceita caminho, barra final, query, credenciais, lista de origens ou *. Nenhum segredo deve ter prefixo VITE_. .env e certificados são ignorados pelo Git. Gere SESSION_SECRET com um gerador criptográfico (por exemplo, 48 bytes aleatórios convertidos para hexadecimal); não use exemplos da documentação como segredo.

Cookies: taskflow_session assinado, HttpOnly, Secure em produção, SameSite=Lax, Path=/, sem Domain, duração de sete dias. Tokens aleatórios são armazenados como SHA-256 no banco; logout revoga a sessão. Alterar SESSION_SECRET invalida os cookies existentes. Não há dependência de cookies de terceiros.

## Migrations e seed

```bash
pnpm prisma:generate
pnpm db:deploy
# Apenas desenvolvimento de novas migrations:
pnpm prisma:migrate
# Apenas ação manual:
pnpm prisma:seed
```

As quatro migrations estão versionadas em prisma/migrations. db:deploy executa prisma migrate deploy; não apaga/recria o banco. Build/start não executam migrations, migrate dev, db push ou seed. Aplique migrations **antes** de liberar uma nova versão. Revise compatibilidade com a versão anterior e backup antes de mudanças de schema.

O seed é idempotente e cria dados demonstrativos (3 projetos e 6 tarefas no workspace demo). Nunca copie automaticamente o banco local para o Render. Em um ambiente de portfólio, pode executar o seed manualmente uma vez, conferindo projetos, tarefas e membros após a execução.

| Conta demonstrativa pública | Senha pública |
| --- | --- |
| kayque@taskflow.demo | 123456 |
| marina@taskflow.demo | 123456 |

Os botões existentes de demonstração usam essas credenciais públicas. Não são segredos nem contas para dados privados. Sem seed, esses botões não terão contas correspondentes. Não misture dados pessoais ou de clientes no workspace demonstrativo. O seed não roda a cada deploy.

## Validações

```powershell
.\node_modules\.bin\prisma.CMD validate
pnpm prisma:generate
# Configure DATABASE_URL temporariamente para DATABASE_URL_TEST para aplicar migrations ao teste.
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Os comandos de teste carregam .env. A integração limpa tabelas do banco de teste e verifica autorização por workspace/IDs, membros bloqueados, sessões, CRUD e idempotência do seed. Sem DATABASE_URL_TEST válida, a integração é marcada skipped; isso não conta como validação completa.

## Build e execução de produção

```bash
pnpm build
pnpm start
```

build gera Prisma, faz typecheck, compila Vue em dist e backend em dist-server. start executa JavaScript com Node, força produção, valida variáveis e conecta ao banco antes de escutar em 0.0.0.0:$PORT. Não usa tsx watch ou Vite preview. NODE_ENV, banco e origem devem estar configurados para produção; o .env de desenvolvimento não é configuração válida para start.

Fastify serve assets e as rotas conhecidas do Vue (incluindo /dashboard e rotas de detalhes/convites), com fallback para index.html. API e assets inexistentes retornam 404; a API continua JSON. HTML revalida cache. SIGTERM/SIGINT fecham Fastify e Prisma, com prazo de dez segundos. /api/health consulta SELECT 1, tem timeout de dois segundos e retorna 503 genérico quando o banco não responde.

## Smoke de produção local com navegador

Pare Vite e tsx antes. O smoke inicia **pnpm start** com a configuração de produção, termina o processo e o reinicia para testar persistência. Usa somente o PostgreSQL local de DATABASE_URL_TEST. Requer que o usuário local possa criar/remover uma role temporária, que o hostname da máquina alcance a porta do PostgreSQL e que as migrations estejam aplicadas.

```powershell
node node_modules/@playwright/test/cli.js install chromium
pnpm build
pnpm smoke:production
```

Requer OpenSSL (no Windows, usa o incluído no Git; sobrescreva OPENSSL_BIN se necessário). Reserva portas 3100 e 3443. Cria certificado temporário e proxy HTTPS local em https://taskflow.test:3443; o Chromium resolve esse nome para 127.0.0.1 sem alterar hosts. Aceitar o certificado autoassinado é exclusivo do contexto de teste. O script cria credenciais aleatórias de banco, remove a role ao terminar e deixa registros de smoke apenas no banco de teste. Evidências e screenshots ficam em outputs/production-smoke, ignorado pelo Git.

Verifica cadastro/login/perfil/sessão/logout, cookie Secure/HttpOnly/Lax, workspace/projeto/tarefa/status, Dashboard/Calendário/Relatórios, acesso direto/refresh, assets/API 404 e persistência após reinício. No Windows, o reinício encerra a árvore do processo; o tratamento de sinais Unix deve ser confirmado no primeiro deploy Render.

Smoke HTTP após deploy:

```bash
curl -fsS https://taskflow-identificador.onrender.com/api/health
curl -I https://taskflow-identificador.onrender.com/dashboard
curl -i https://taskflow-identificador.onrender.com/api/inexistente
curl -i https://taskflow-identificador.onrender.com/assets/inexistente.js
```

Esperado: 200 JSON, 200 HTML, 404 JSON, 404. No navegador, repita login, recarga de /dashboard e logout; confira Secure/HttpOnly/Lax nas ferramentas de desenvolvimento.

## Publicação no Render — passos manuais

1. Crie um repositório no seu provedor Git. Confira o commit local, adicione remote e faça push quando decidir publicar. Nenhum remote/push é criado automaticamente.
2. No Render, crie **PostgreSQL**. Escolha região e plano conscientemente; não há plano pago presumido. Crie o banco vazio e use credenciais geradas pelo serviço.
3. Crie **Web Service**, conecte o repositório/branch main, runtime Node e mesma região do banco. Nome: taskflow-<identificador>. Mantenha deploy automático desligado até concluir migrations/configuração. Não crie Static Site ou frontend Vercel.
4. Configure as variáveis da tabela: NODE_ENV=production, APP_ORIGIN com a URL exata atribuída, COOKIE_SECURE=true, SESSION_SECRET aleatório e DATABASE_URL interna do PostgreSQL. PORT é fornecida pelo Render. Use Node 22 compatível com engines e pnpm 11.25.0.
5. Use os comandos abaixo. Instale devDependencies no build: TypeScript e a CLI Prisma são necessários.
6. Aplique migrations antes da nova versão. Configure healthcheck /api/health. Faça o primeiro deploy manual e valide pelo domínio HTTPS.

| Campo Render | Comando |
| --- | --- |
| Build Command | pnpm install --frozen-lockfile --prod=false && pnpm build |
| Pre-Deploy Command | pnpm exec prisma migrate deploy |
| Start Command | pnpm start |
| Health Check Path | /api/health |

Pre-deploy depende da disponibilidade desse recurso no plano. Se não estiver disponível, execute migrate deploy manualmente de um ambiente confiável com acesso ao banco, antes do deploy; mantenha deploy automático desligado. Não mova migrations para o build, nem use migrate dev/db push.

Conexão: use a URL interna para serviços na mesma região. Acrescente parâmetros Prisma, preservando os existentes: connection_limit=5&pool_timeout=10&connect_timeout=5&socket_timeout=10. Comece com uma instância; ajuste o limite para que instâncias × 5, migrations e administração caibam no limite do PostgreSQL.

Para TLS, siga a configuração do banco Render: conexões externas exigem TLS (sslmode=require); internas suportam TLS com certificado autoassinado. Configure sslmode=require também na URL interna quando habilitado e valide a conexão. Não use sslmode=disable para conexões externas. Ao executar migration externa, use a URL externa fornecida pelo Render com TLS e restrinja acesso de rede; não versione essa URL. Confira backups/retenção conforme o plano escolhido.

Fontes oficiais: [Web Services](https://render.com/docs/web-services), [etapas e pre-deploy](https://render.com/docs/deploys), [PostgreSQL e TLS](https://render.com/docs/postgresql-creating-connecting).

## Vercel somente no futuro

Separar o frontend exigirá vercel.json com fallback SPA, tornar VITE_API_URL configurável no build de produção, CORS exato e revisão de cookies entre domínios. Prefira domínio personalizado ou proxy seguro para preservar autenticação. Esta entrega serve /api na mesma origem e não configura Vercel.

Consulte [arquitetura](docs/ARCHITECTURE.md), [limitações](TECHNICAL_DEBT.md) e [auditoria de produção](docs/PRODUCTION_REVIEW.md).
