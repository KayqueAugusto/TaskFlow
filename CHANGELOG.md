# Changelog

Este projeto segue uma estrutura inspirada no [Keep a Changelog](https://keepachangelog.com/).

## [0.1.1] — 2026-09-26

### Fixed

- Contraste corrigido nas quatro abas selecionadas de Minhas tarefas no tema escuro, preservando o fundo lilás e o peso da fonte.
- Atalho da busca adaptado ao tema escuro com fundo transparente, borda discreta e texto claro; visual claro preservado.
- Identidade colorida dos ícones do Dashboard preservada e validada nos dois temas.
- Badges de status com tokens compartilhados mais vivos e consistentes: âmbar para Pendente, azul para Em andamento e verde para Concluída.
- Nenhuma alteração de API, banco de dados ou regras de negócio; layout, dimensões, tipografia e espaçamentos preservados.

### Validation

- Validação em Chromium com API simulada, sem banco, incluindo abas, badges, ícones, atalho, persistência do tema e Login/Cadastro claros após logout.
- Comparação de dimensões e tipografia com a tag v0.1.0 e contraste mínimo de 4,5:1 nos textos das abas selecionadas e badges.
- Script reutilizável: após `pnpm build`, executar `node scripts/check-contrast.mjs`. Capturas e resultados ficam em `outputs/contrast`.

## [0.1.0] — 2026-09-26

### Added

- Baseline técnica do MVP TaskFlow com Vue 3, TypeScript, Vite, Pinia, Vue Router, Fastify, Prisma e PostgreSQL.
- Autenticação, sessões, perfil, workspaces, membros, permissões, convites por link, projetos, tarefas, responsáveis e atividades persistidos.
- Dashboard, Minhas tarefas, Projetos, Calendário, Equipe e Relatórios integrados à API.
- Testes unitários, testes HTTP, integração PostgreSQL e smoke de produção local.
- Preparação para publicação em uma única origem no Render.

### Fixed

- Tema escuro limitado à área autenticada; Login, Cadastro e páginas públicas mantêm o visual claro aprovado após logout e recarregamento.

### Known limitations

- OAuth Google, recuperação de senha, envio real de convites por e-mail, upload externo de avatar e notificações em tempo real continuam fora do MVP.
- Observabilidade, CI e deploy público ainda não foram realizados.
- A política final de exclusão de workspace permanece pendente.
