# Arquitetura do TaskFlow

## Produção na mesma origem

```text
Navegador HTTPS → proxy TLS do Render → Fastify (0.0.0.0:PORT)
                                        ├─ rotas Vue + assets: dist/
                                        └─ /api/* → serviços → Prisma → PostgreSQL gerenciado
```

O frontend usa /api em builds de produção. VITE_API_URL é apenas configuração de desenvolvimento. No desenvolvimento, Vite e Fastify continuam processos separados. APP_ORIGIN é validada como origem exata e alimenta CORS e links de convite.

## Build e processo

pnpm build gera Prisma Client, verifica tipos e gera dist/ (Vite) e dist-server/ (tsc/NodeNext). Esses diretórios não são versionados. O backend usa imports .js compatíveis com ESM/Node e não inclui testes ou seed. O repositório de autenticação em memória fica somente em tests/.

pnpm start executa dist-server/start.js: força NODE_ENV=production e importa o bootstrap. O bootstrap valida Zod e presença do frontend, conecta Prisma e só então escuta. SIGTERM/SIGINT encerram Fastify/Prisma; erros de bootstrap são genéricos e não imprimem credenciais.

@fastify/static serve somente dist. O fallback é restrito às rotas conhecidas do Router e métodos GET/HEAD; /api, arquivos inexistentes e rotas desconhecidas não recebem HTML. A rota raiz serve explicitamente index.html.

## Segurança e sessão

Sessões opacas aleatórias, cookie assinado com SESSION_SECRET, HttpOnly, SameSite=Lax, Secure em produção, Path=/ e sem Domain. O banco armazena hash SHA-256 do token, expiração de sete dias e revogação. Não há token de autenticação no localStorage. Uma troca de segredo exige novo login.

Zod valida entradas e ambiente. Origin divergente é recusada nas escritas; CORS aceita somente APP_ORIGIN com credenciais. Isso complementa SameSite=Lax. Chamadas sem Origin continuam possíveis para clientes HTTP, sujeitas à autenticação/autorização.

Helmet configura headers e CSP: scripts/conexões/fontes da própria origem, imagens locais/data/blob, frame-ancestors none, estilos inline permitidos para bindings existentes. Payload limitado a 1 MiB. Rate limit padrão 100/minuto, login 10/15 minutos, cadastro 5/15 minutos; health e assets não consomem esse limite. As rotas são registradas após os plugins para que o hook do rate limit seja aplicado.

Fastify confia apenas no proxy imediato em produção. Logs excluem cookies, Authorization, query strings e tokens de convite; erros internos não retornam stack, mensagem Prisma ou dados de conexão. Respostas da API usam no-store e envelopes data/error. Status 400/413/429 são preservados.

## Persistência e autorização

AuthService usa PrismaAuthRepository. WorkspaceService verifica membership, papel e bloqueio; BusinessService valida workspace, projetos, tarefas e responsáveis. OWNER/ADMIN administram; MEMBER tem edição limitada a tarefas criadas/atribuídas. Manipular IDs não atravessa workspaces. Bloqueio é por membership e não bloqueia a conta pessoal em outros workspaces. Logout revoga sessão.

Stores de auth/workspaces/business consomem a API. A store legada adapta dados para a interface; preferências e IDs locais não concedem permissão. Dashboard, Calendário e Relatórios derivam de projetos/tarefas reais. Não há importação silenciosa de dados antigos.

## Banco, migrations e readiness

Uma instância Prisma por processo. DATABASE_URL configura conexão, TLS e pool. Valor inicial sugerido: connection_limit=5, pool_timeout=10, connect_timeout=5, socket_timeout=10, ajustado ao limite do banco/instâncias.

Migrations versionadas são aplicadas explicitamente com migrate deploy antes da nova versão. Nenhum comando de criação destrutiva de schema ou seed roda no bootstrap. Seed é manual/idempotente e exclusivamente demonstrativo.

/api/health executa SELECT 1 com deadline de dois segundos. Retorna 200 quando pronto e 503 genérico quando o banco falha. É readiness para o Render, não só confirmação de processo vivo.

## Qualidade e evolução

Vitest cobre serviços, autorização, cookies, erros, ambiente e integração PostgreSQL. Playwright smoke exercita HTTPS local com código compilado, navegação, CRUD, cookies e reinício. Testes não entram no build do servidor.

Uma separação futura na Vercel exigirá fallback SPA, revisão do uso de VITE_API_URL, CORS, domínio/proxy e cookies. Não faz parte da publicação inicial.
