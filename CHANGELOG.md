# Changelog

Este projeto segue uma estrutura inspirada no [Keep a Changelog](https://keepachangelog.com/).

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

