import type { Account, Member, Membership, Project, Task, Workspace } from "./models";

export const seedMembers:Member[]=[
  {id:1,name:"Kayque Milhome",email:"kayque@taskflow.demo",job:"Front-End Developer",role:"Administrador",initials:"KM",color:"purple"},
  {id:2,name:"Marina Costa",email:"marina@taskflow.demo",job:"Product Designer",role:"Membro",initials:"MC",color:"coral"},
  {id:3,name:"João Silva",email:"joao@taskflow.demo",job:"Mobile Developer",role:"Membro",initials:"JS",color:"blue-avatar"},
  {id:4,name:"Ana Martins",email:"ana@taskflow.demo",job:"QA Analyst",role:"Membro",initials:"AM",color:"green-avatar"}
];
export const seedProjects:Project[]=[
  {id:1,name:"Website Institucional",description:"Redesign completo do site e otimização da experiência.",start:"2026-09-01",due:"2026-10-15",members:[1,2,3],color:"#6c5ce7"},
  {id:2,name:"Sistema de Gestão",description:"Plataforma interna para processos e indicadores.",start:"2026-08-20",due:"2026-11-30",members:[1,2,4],color:"#22b8a0"},
  {id:3,name:"Aplicativo Mobile",description:"Aplicativo para clientes com foco em autosserviço.",start:"2026-09-05",due:"2026-12-10",members:[1,3,4],color:"#f5a524"}
];
export const seedTasks:Task[]=[
  {id:1,title:"Finalizar protótipo da nova área",projectId:1,due:"2026-09-14",status:"Em andamento",priority:"Alta",assigneeId:1,description:"Finalizar estados responsivos e preparar o protótipo."},
  {id:2,title:"Revisar componentes do dashboard",projectId:2,due:"2026-09-15",status:"Pendente",priority:"Média",assigneeId:2,description:"Revisar consistência visual e acessibilidade."},
  {id:3,title:"Ajustar responsividade mobile",projectId:3,due:"2026-09-16",status:"Em andamento",priority:"Alta",assigneeId:3,description:"Corrigir quebras de layout em telas menores."},
  {id:4,title:"Validar fluxo de autenticação",projectId:2,due:"2026-09-12",status:"Pendente",priority:"Alta",assigneeId:4,description:"Executar os cenários de entrada e encerramento."},
  {id:5,title:"Publicar guia de identidade visual",projectId:1,due:"2026-09-11",status:"Concluída",priority:"Baixa",assigneeId:1,description:"Documentar tipografia, cores e componentes."},
  {id:6,title:"Mapear eventos de analytics",projectId:1,due:"2026-09-18",status:"Pendente",priority:"Média",assigneeId:2,description:"Definir eventos essenciais do funil."}
];
export const seedAccounts:Account[]=[
  {id:1,name:"Kayque Milhome",email:"kayque@taskflow.demo",password:"123456",job:"Front-End Developer",initials:"KM"},
  {id:2,name:"Marina Costa",email:"marina@taskflow.demo",password:"123456",job:"Product Designer",initials:"MC"}
];
export const seedWorkspaces:Workspace[]=[{id:1,name:"TaskFlow Pessoal",ownerId:1},{id:2,name:"Tech6",ownerId:2},{id:3,name:"Workspace da Marina",ownerId:2}];
export const seedMemberships:Membership[]=[{accountId:1,workspaceId:1,role:"Administrador"},{accountId:1,workspaceId:2,role:"Membro"},{accountId:2,workspaceId:1,role:"Membro"},{accountId:2,workspaceId:3,role:"Administrador"}];

