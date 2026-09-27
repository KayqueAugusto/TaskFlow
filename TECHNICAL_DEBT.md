# Limitações e dívida técnica

## Estado atual

O MVP usa PostgreSQL para autenticação, sessões, perfil, workspaces, membros/permissões, convites por link, projetos, tarefas, responsáveis e atividades. Dashboard, Calendário e Relatórios usam os mesmos registros reais. As descrições anteriores de autenticação mockada/localStorage não descrevem mais o fluxo ativo.

A interface foi preservada nesta entrega. Preparação de produção não equivale a publicação: Git remoto, provisionamento, secrets, migrations e primeiro deploy Render são ações manuais.

## Fora do MVP — não implementado

- OAuth Google e recuperação de senha.
- Envio de convite por e-mail.
- Armazenamento externo de avatar; o perfil ainda aceita imagens data URL limitadas pelo payload.
- Notificações em tempo real; o indicador atual deriva de tarefas.
- Política final de exclusão de workspace; operação permanece bloqueada.
- Importação automática de dados antigos do localStorage.

## Limites conhecidos

- As contas demo e respectivas senhas são públicas no seed, documentação e botões existentes. Só devem acessar dados demonstrativos; não representam credenciais privadas.
- A store legada ainda contém métodos locais e seeds para compatibilidade. O fluxo de identidade ativo é a API; a autorização é sempre validada por workspace no servidor. Remover completamente esse legado exige uma entrega separada com testes de interface.
- Rate limiting é em memória por instância, reinicia com o processo e não é compartilhado. A configuração inicial é para uma instância; avaliar armazenamento compartilhado antes de escalar.
- Prisma mantém sessões expiradas/revogadas; falta rotina de retenção/limpeza. Expiração e revogação já impedem autenticação.
- Consultas de negócio têm limite de 200 itens. Paginação e consolidação de relatórios para volumes maiores ficam para outra entrega.
- Atividades e membros retornam dados de perfil/e-mail para membros autorizados do workspace; não há acesso público, nem exposição de passwordHash/session token.
- Alguns elementos visuais permanecem ilustrativos (por exemplo, segmentos decorativos do gráfico do Dashboard). A fonte dos contadores é real; nenhum redesign foi feito.
- Backups, retenção, disponibilidade e limites do PostgreSQL dependem do plano Render escolhido pelo proprietário.
- CSP permite estilos inline porque a interface Vue usa bindings de estilo; scripts permanecem restritos à própria origem. Ícones e avatares são locais.
- Confiança no proxy limitada ao salto imediato. Verificar endereço do cliente e rate limit após qualquer mudança de proxy/topologia.
- No Windows, o smoke reinicia o processo por encerramento da árvore; a entrega de SIGTERM/SIGINT do Render/Linux precisa de confirmação no primeiro deploy.
- Contas demonstrativas usam senha fraca por contrato existente da demonstração. Cadastro real exige senha de pelo menos oito caracteres; não reutilizar a conta demo para dados privados.

Veja README para validações, TLS, pool, deploy e smoke. Não há seed automático, cópia automática de banco ou deploy Vercel.
