# Dívida técnica e inventário funcional

Este documento descreve com transparência o estado da baseline do TaskFlow. “Funcional” significa funcional **no navegador atual, com `localStorage`**; não implica integração de produção.

## Entrega de fundação — 2026-09-15

- Concluído: modelos e seeds extraídos da store; acesso a armazenamento centralizado e versionado; contratos de fonte de dados; Fastify com health, CORS, rate limiting e erros padronizados; schema Prisma, migration inicial, seed com bcrypt; testes iniciais de armazenamento e API.
- Parcial: backend e banco estão preparados, mas somente o health está executável e nenhuma migration foi aplicada por não haver PostgreSQL disponível neste ambiente.
- Simulado: todos os fluxos de negócio da interface, inclusive autenticação, autorização, convites, projetos e tarefas, continuam locais.
- Não implementado: endpoints de autenticação/domínio, cookies/sessões reais, repositories Prisma, integração web/API, importação do legado e E2E.

Não houve alteração visual. O diretório fornecido não contém metadados Git reconhecíveis, portanto o estado/commit anterior não pôde ser verificado nesta cópia.

## Classificação

1. **Implementado e funcional:** fluxo utilizável e persistente no navegador atual.
2. **Implementado parcialmente:** existe fluxo utilizável, mas faltam garantias, integrações ou casos relevantes.
3. **Simulado/mockado no frontend:** aparência e interação de demonstração sem serviço real por trás.
4. **Ainda não implementado:** capacidade ausente da baseline.

## Matriz de funcionalidades

| Área | Estado | O que existe hoje | Limite ou pendência |
| --- | --- | --- | --- |
| Login por e-mail/senha | 1 — Funcional local | Validação contra contas do `localStorage`, contas demo, lembrar e-mail, sessão persistente e logout | Senhas ficam em texto puro no cliente; não há identidade de servidor |
| Proteção de rotas | 2 — Parcial | Guards do Vue Router redirecionam visitantes sem sessão e restringem páginas por papel | Feita no cliente; URLs não são protegidas no servidor e permissões podem ser adulteradas |
| Cadastro por formulário | 1 — Funcional local | Cria conta, workspace pessoal, membership e sessão no navegador | Não valida e-mail único de forma robusta, não verifica e-mail e não sincroniza entre dispositivos |
| Continuar com Google | 3 — Mockado | O botão exibe uma mensagem informando que a integração ainda é demonstrativa | Não existe Google OAuth, consentimento, token ou vínculo com uma conta Google real |
| Recuperação de senha | 4 — Não implementado | O link mostra uma mensagem informativa | Falta fluxo, token, e-mail e redefinição segura |
| Sessão | 2 — Parcial | Persiste em `taskflow_session` após atualização | Não há cookie seguro, expiração, revogação, refresh token ou proteção contra adulteração |
| Conta pessoal | 2 — Parcial | Nome, e-mail, cargo, avatar e memberships ficam separados dos dados do workspace | Modelo vive no cliente; edição de e-mail e exclusão de conta não existem |
| Foto/avatar do perfil | 1 — Funcional local | Upload exibido com recorte circular, avatares sugeridos e fallback por iniciais | Data URL no `localStorage`; sem recorte físico do arquivo, storage externo, validação de conteúdo ou sincronização remota |
| Edição de nome/cargo | 1 — Funcional local | Atualiza conta, sessão e representação do membro nos workspaces locais | Consistência depende de múltiplas escritas no `localStorage`, sem transação |
| Múltiplos workspaces | 2 — Parcial | Criar, listar, trocar e sair de workspace; papel por membership; dados separados por `workspaceId` | Somente local, sem colaboração real, slug, plano, limites ou sincronização |
| Permissões por workspace | 2 — Parcial | Administrador e Membro afetam navegação e ações; membro vê principalmente itens relacionados | Autorização só no cliente; falta matriz granular e validação em API |
| Transferência de proprietário | 4 — Não implementado | O proprietário/último admin é protegido contra bloqueio, remoção e rebaixamento | Não existe fluxo para transferir propriedade ou administração principal |
| Convite por e-mail | 3 — Mockado | Administrador cria registro local de convite com cargo e permissão | Nenhum e-mail é enviado; o destinatário precisa existir no mesmo armazenamento do navegador |
| Aceitar/recusar convite | 2 — Parcial | Convites locais compatíveis com o e-mail da sessão aparecem nas notificações e podem gerar membership | Não funciona entre dispositivos/usuários reais e não há token seguro ou expiração |
| Link de convite | 3 — Mockado | Gera, copia, habilita/desabilita e regenera código por workspace | `https://taskflow.app/invite/...` não possui rota nem resolução de token; não concede acesso real |
| Entrada/saída de organização | 2 — Parcial | Membro pode sair localmente; convite local pode adicionar membership | Sem auditoria, confirmação por servidor, política de propriedade ou reatribuição completa |
| Listagem da equipe | 1 — Funcional local | Cards circulares, cargo, papel, status, foto/avatar e contagem de tarefas | Dados existem apenas no workspace do navegador |
| Adicionar membro | 3 — Mockado/convite local | O botão reutiliza o formulário de convite | Não provisiona usuário real nem envia convite externo |
| Editar membro | 1 — Funcional local | Administrador altera cargo e papel, com proteção ao admin principal | Alteração não é segura fora do cliente |
| Bloquear/desbloquear membro | 2 — Parcial | Persiste flag e impede acesso local ao workspace | Sem revogação server-side; uma pessoa pode manipular o armazenamento |
| Remover membro | 2 — Parcial | Remove membership local, retira de projetos e reatribui tarefas ao administrador atual | Estratégia de reatribuição é simplificada e não há histórico/auditoria |
| Atividades do membro | 1 — Funcional local | Mostra dados do membro, projetos e tarefas relacionados | Não existe log de eventos; “atividades” são relações atuais, não histórico temporal |
| Projetos | 1 — Funcional local | Criar, listar, abrir detalhes, membros, prazo e progresso automático | Não há edição/exclusão de projeto nem estados avançados |
| Tarefas | 1 — Funcional local | Criar, editar, excluir, filtrar, buscar, atribuir e alterar status conforme papel | Sem comentários, anexos, subtarefas, recorrência, histórico ou concorrência |
| Fonte compartilhada de dados | 1 — Funcional local | Dashboard, projetos, equipe, calendário e relatórios usam a mesma store Pinia | Persistência ainda não possui schema ou versionamento |
| Dashboard | 1 — Funcional local | Métricas e progresso derivam das tarefas visíveis; cards/legendas navegam com filtros | Indicadores são básicos e não possuem séries históricas |
| Calendário | 1 — Funcional local | Visões mês/semana, navegação temporal e abertura de tarefa pelo prazo | Sem drag-and-drop, timezone explícito, eventos externos ou recorrência |
| Relatórios | 2 — Parcial | Resumos locais derivados dos dados e exportação CSV | Sem filtros avançados, histórico, geração no servidor, PDF ou grandes volumes |
| Busca e filtros | 1 — Funcional local | Pesquisa de tarefas/projetos e filtros por status/prioridade | Busca apenas dados carregados no cliente |
| Notificações | 3 — Mockado/local | Popover mostra tarefas pendentes e convites locais; preferência pode ocultá-lo | Sem serviço, push, e-mail, agenda, leitura persistente ou eventos em tempo real |
| Resumo semanal | 3 — Mockado/local | Preferência controla a exibição de um resumo derivado no dashboard | Nenhum resumo é enviado e não há agendamento semanal |
| Tema claro/escuro/sistema | 1 — Funcional local | Tema global persistido por conta | Preferência não é sincronizada entre dispositivos |
| Modo compacto | 1 — Funcional local | Reduz paddings, alturas e espaçamentos globalmente após salvar | Cobertura visual depende das classes CSS existentes |
| Salvar configurações | 1 — Funcional local | Persiste preferências por conta e exibe confirmação | Não há preferências no servidor |
| Ajuda | 3 — Mockado | Ícone exibe feedback local | Não há central de ajuda ou documentação contextual integrada |
| Exportação CSV | 1 — Funcional local | Gera arquivo CSV das tarefas visíveis | Executada no navegador, sem configuração de colunas ou processamento robusto |
| Responsividade e dropdowns | 1 — Funcional local | Layout responsivo; menus fecham por clique externo, seleção ou `Esc` | Falta uma auditoria completa de acessibilidade por teclado/leitor de tela |
| Backend/API | 2 — Parcial | Bootstrap Fastify, health, CORS, rate limiting, configuração Zod e respostas padronizadas | Faltam autenticação, endpoints de negócio, repositories e integração com a UI |
| Banco/migrations/seeds de servidor | 2 — Parcial | Schema PostgreSQL/Prisma, migration inicial, índices/constraints e seed demo com bcrypt | Migration ainda não foi aplicada contra uma instância PostgreSQL nesta cópia |
| Autenticação e segurança de produção | 4 — Não implementado | — | Hash de senha/IdP, sessões seguras, CSRF/XSS, rate limiting, autorização server-side e gestão de segredos |
| Testes automatizados | 2 — Parcial | Testes Vitest do adaptador local e integração do health/404 via Fastify inject | Faltam regras críticas, banco real, componentes e E2E |
| CI/CD e qualidade automatizada | 4 — Não implementado | Scripts locais de lint, typecheck e build | Falta pipeline, cobertura, preview por PR e políticas de merge |
| Observabilidade e auditoria | 4 — Não implementado | — | Logs estruturados, métricas, rastreamento de erros e trilha de ações administrativas |
| Tempo real e colaboração concorrente | 4 — Não implementado | — | WebSocket/SSE, conflitos, presença e atualização multiusuário |

## Riscos arquiteturais atuais

### 1. Store de demonstração ainda concentrada

Tipos, seeds e acesso bruto ao armazenamento foram extraídos, mas `src/stores/taskflow.ts` ainda concentra autenticação local e regras mutáveis. A próxima fase deve migrar um agregado por vez para serviços/repositories.

### 2. Modelo sem schema e sem versionamento

As chaves agora passam por um adaptador e novas gravações registram `taskflow_storage_version=1`; JSON inválido não é apagado. Ainda faltam validação estrutural completa e migrations entre versões.

Chaves: `taskflow_session`, `taskflow_accounts`, `taskflow_workspaces`, `taskflow_memberships`, `taskflow_invites`, `taskflow_tasks_{workspaceId}`, `taskflow_projects_{workspaceId}`, `taskflow_members_{workspaceId}`, `taskflow_prefs_{accountId}` e `taskflow_remember_email`.

### 3. Identificadores baseados em `Date.now()`

Contas, workspaces e entidades novas usam timestamps como ID. Isso não garante unicidade em ambiente distribuído e deve ser substituído por IDs gerados no servidor.

### 4. Proteção somente no cliente

A navegação agora usa Vue Router e guards declarativos. Ainda é necessário implementar autorização no servidor quando existir uma API real.

### 5. Persistência não transacional

Uma ação pode atualizar contas, memberships, membros, projetos e tarefas em escritas independentes. Falhas intermediárias podem produzir inconsistência. Um banco com transações e constraints deve se tornar a fonte de verdade.

### 6. Dívida de legibilidade e tipos

O componente principal está altamente compactado e usa `any` em vários contratos. O ESLint contém exceções locais para preservar a baseline. Refatorar formatação, tipos e componentes em mudanças pequenas e verificáveis.

## Ordem sugerida para a próxima fase

1. Congelar comportamentos com testes E2E dos fluxos administrador/membro.
2. Implementar repositories Prisma, autenticação e autorização por membership no servidor.
3. Separar autenticação, workspaces, projetos, tarefas, equipe e preferências em módulos.
4. Integrar a UI à API gradualmente via `TaskFlowDataSource`.
5. Migrar convites e arquivos de perfil para serviços reais.
6. Adicionar observabilidade, segurança, testes de integração com PostgreSQL e CI.

## Itens removidos na consolidação

- 61 componentes Shadcn nunca importados e seus utilitários exclusivos;
- dependências npm usadas somente por esses componentes;
- exemplo vazio de D1/Drizzle, configuração e dependências associadas;
- helper opcional de “Sign in with ChatGPT” nunca importado;
- ícones padrão do starter não referenciados.

O protótipo agora utiliza build estático do Vite para hospedagem no Sites.

## Entrega vertical de autenticação — 2026-09-16

- Concluído: endpoints `/api/auth/register`, `/login`, `/logout`, `/me` e `PATCH /me`; bcrypt; sessões persistidas/revogáveis em cookie HttpOnly; validação, expiração e rate limiting específico; Pinia com estados de autenticação e guards baseados em `/me`; perfil básico.
- Parcial: projetos, tarefas, relatórios, calendário, workspaces e membros continuam no adaptador local. O contexto local é derivado do usuário seguro da API e não armazena token.
- Simulado: OAuth Google, recuperação de senha, convites por e-mail e upload externo.
- Ambiente: Node 22.12.0 (requisito 22.13+), Docker/PostgreSQL/Git ausentes; migration/seed reais e testes contra PostgreSQL não puderam ser executados.
- Verificação adicional: `prisma generate` passou; `prisma migrate deploy` encontrou um PostgreSQL em `localhost:5432`, mas falhou com `P1000` (credenciais locais não correspondem ao `.env.example`). Nenhum banco foi alterado.

## Infraestrutura PostgreSQL — 2026-09-16

- Corrigido o conflito de portas: Compose expõe `5433:5432`; o PostgreSQL Windows em `5432` não é parado, alterado ou acessado pelo Compose.
- Adicionado banco `taskflow_test` via script de inicialização idempotente e `DATABASE_URL_TEST` separado.
- `.env` local foi criado com a porta `5433` e permanece ignorado; não contém credencial de produção.
- Pendente neste ambiente: Docker não está instalado, portanto containers, migrations, seed duplo e integração PostgreSQL real ainda precisam ser executados localmente.
- Verificação de fechamento: a porta `5433` permaneceu livre e a porta Windows `5432` continuou ativa. `docker compose up -d` não pôde executar (Docker ausente); `prisma migrate deploy` em `5433` retornou `P1001` porque nenhum container TaskFlow estava escutando. Nenhum volume foi removido.
## Situação atual — 2026-09-18

Autenticação, workspaces, memberships, permissões e convites agora usam Fastify e PostgreSQL. As linhas antigas abaixo registram a auditoria histórica do protótipo e não descrevem o estado atual desses módulos. O convite é persistido, mas o envio de e-mail ainda não existe: o link deve ser copiado. A exclusão de workspace foi desabilitada até a migração de projetos e tarefas. Esses dois agregados, calendário, relatórios derivados e notificações ainda usam dados locais e podem divergir entre dispositivos. A próxima fase recomendada é migrar projetos/tarefas para API, preservar vínculos com memberships e então eliminar as representações legadas da store.
