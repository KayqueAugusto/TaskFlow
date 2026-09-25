import { PrismaClient, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedDatabase(prisma:PrismaClient){
const passwordHash=await bcrypt.hash("123456",12);
const kayqueId="00000000-0000-4000-8000-000000000001";
const marinaId="00000000-0000-4000-8000-000000000002";
const workspaceId="00000000-0000-4000-8000-000000000101";
const projectId="00000000-0000-4000-8000-000000000201";
const project2Id="00000000-0000-4000-8000-000000000202";
const project3Id="00000000-0000-4000-8000-000000000203";
const kayque=await prisma.user.upsert({
  where:{email:"kayque@taskflow.demo"},update:{},
  create:{id:kayqueId,email:"kayque@taskflow.demo",credential:{create:{passwordHash}},profile:{create:{name:"Kayque Milhome",jobTitle:"Front-End Developer"}},preferences:{create:{}}}
});
const marina=await prisma.user.upsert({
  where:{email:"marina@taskflow.demo"},update:{},
  create:{id:marinaId,email:"marina@taskflow.demo",credential:{create:{passwordHash}},profile:{create:{name:"Marina Costa",jobTitle:"Product Designer"}},preferences:{create:{}}}
});
const workspace=await prisma.workspace.upsert({where:{id:workspaceId},update:{},create:{id:workspaceId,name:"TaskFlow Pessoal",ownerId:kayque.id,memberships:{create:[{userId:kayque.id,role:WorkspaceRole.OWNER},{userId:marina.id,role:WorkspaceRole.MEMBER}]}}});
await prisma.membership.upsert({where:{workspaceId_userId:{workspaceId:workspace.id,userId:kayque.id}},update:{},create:{workspaceId:workspace.id,userId:kayque.id,role:workspace.ownerId===kayque.id?WorkspaceRole.OWNER:WorkspaceRole.ADMIN}});
await prisma.membership.upsert({where:{workspaceId_userId:{workspaceId:workspace.id,userId:marina.id}},update:{},create:{workspaceId:workspace.id,userId:marina.id,role:WorkspaceRole.MEMBER}});
const projects=[
  {id:projectId,name:"Website Institucional",description:"Redesign completo do site e otimização da experiência.",color:"#6c5ce7",startsAt:new Date("2026-09-01T00:00:00Z"),dueAt:new Date("2026-10-15T00:00:00Z")},
  {id:project2Id,name:"Sistema de Gestão",description:"Plataforma interna para processos e indicadores.",color:"#22b8a0",startsAt:new Date("2026-08-20T00:00:00Z"),dueAt:new Date("2026-11-30T00:00:00Z")},
  {id:project3Id,name:"Aplicativo Mobile",description:"Aplicativo para clientes com foco em autosserviço.",color:"#f5a524",startsAt:new Date("2026-09-05T00:00:00Z"),dueAt:new Date("2026-12-10T00:00:00Z")}
];
for(const item of projects){await prisma.project.upsert({where:{id:item.id},update:{name:item.name,description:item.description,color:item.color,startsAt:item.startsAt,dueAt:item.dueAt},create:{...item,workspaceId:workspace.id,createdById:kayque.id}});for(const userId of [kayque.id,marina.id])await prisma.projectMember.upsert({where:{projectId_userId:{projectId:item.id,userId}},update:{},create:{projectId:item.id,userId}})}
const tasks=[
  {id:"00000000-0000-4000-8000-000000000301",projectId,title:"Finalizar protótipo da nova área",description:"Finalizar estados responsivos e preparar o protótipo.",status:"IN_PROGRESS" as const,priority:"HIGH" as const,dueAt:new Date("2026-09-28T00:00:00Z"),userId:kayque.id},
  {id:"00000000-0000-4000-8000-000000000302",projectId:project2Id,title:"Revisar componentes do dashboard",description:"Revisar consistência visual e acessibilidade.",status:"PENDING" as const,priority:"MEDIUM" as const,dueAt:new Date("2026-10-02T00:00:00Z"),userId:marina.id},
  {id:"00000000-0000-4000-8000-000000000303",projectId:project3Id,title:"Ajustar responsividade mobile",description:"Corrigir quebras de layout em telas menores.",status:"IN_PROGRESS" as const,priority:"HIGH" as const,dueAt:new Date("2026-10-06T00:00:00Z"),userId:marina.id},
  {id:"00000000-0000-4000-8000-000000000304",projectId:project2Id,title:"Validar fluxo de autenticação",description:"Executar cenários críticos de autenticação.",status:"PENDING" as const,priority:"HIGH" as const,dueAt:new Date("2026-09-30T00:00:00Z"),userId:kayque.id},
  {id:"00000000-0000-4000-8000-000000000305",projectId,title:"Publicar guia de identidade visual",description:"Documentar tipografia, cores e componentes.",status:"COMPLETED" as const,priority:"LOW" as const,dueAt:new Date("2026-09-20T00:00:00Z"),completedAt:new Date("2026-09-19T15:00:00Z"),userId:kayque.id},
  {id:"00000000-0000-4000-8000-000000000306",projectId,title:"Mapear eventos de analytics",description:"Definir eventos essenciais do funil.",status:"PENDING" as const,priority:"MEDIUM" as const,dueAt:new Date("2026-10-10T00:00:00Z"),userId:marina.id}
];
for(const item of tasks){const task=await prisma.task.upsert({where:{id:item.id},update:{title:item.title,description:item.description,status:item.status,priority:item.priority,dueAt:item.dueAt,completedAt:item.completedAt??null,projectId:item.projectId},create:{id:item.id,workspaceId:workspace.id,projectId:item.projectId,createdById:kayque.id,title:item.title,description:item.description,status:item.status,priority:item.priority,dueAt:item.dueAt,completedAt:item.completedAt??null}});await prisma.taskAssignee.upsert({where:{taskId_userId:{taskId:task.id,userId:item.userId}},update:{},create:{taskId:task.id,userId:item.userId}})}
await prisma.activity.upsert({where:{id:"00000000-0000-4000-8000-000000000401"},update:{},create:{id:"00000000-0000-4000-8000-000000000401",workspaceId:workspace.id,actorId:kayque.id,type:"TASK_COMPLETED",payload:{taskId:tasks[4].id,userId:kayque.id}}});
}

if(process.argv[1]?.replace(/\\/g,"/").endsWith("/prisma/seed.ts")){
  const prisma=new PrismaClient();
  try{await seedDatabase(prisma)}finally{await prisma.$disconnect()}
}
