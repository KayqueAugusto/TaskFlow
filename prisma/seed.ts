import { PrismaClient, WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma=new PrismaClient();
const passwordHash=await bcrypt.hash("123456",12);
const kayqueId="00000000-0000-4000-8000-000000000001";
const marinaId="00000000-0000-4000-8000-000000000002";
const workspaceId="00000000-0000-4000-8000-000000000101";
const projectId="00000000-0000-4000-8000-000000000201";
const kayque=await prisma.user.upsert({
  where:{email:"kayque@taskflow.demo"},update:{},
  create:{id:kayqueId,email:"kayque@taskflow.demo",credential:{create:{passwordHash}},profile:{create:{name:"Kayque Milhome",jobTitle:"Front-End Developer"}},preferences:{create:{}}}
});
const marina=await prisma.user.upsert({
  where:{email:"marina@taskflow.demo"},update:{},
  create:{id:marinaId,email:"marina@taskflow.demo",credential:{create:{passwordHash}},profile:{create:{name:"Marina Costa",jobTitle:"Product Designer"}},preferences:{create:{}}}
});
const workspace=await prisma.workspace.upsert({where:{id:workspaceId},update:{},create:{id:workspaceId,name:"TaskFlow Pessoal",ownerId:kayque.id,memberships:{create:[{userId:kayque.id,role:WorkspaceRole.OWNER},{userId:marina.id,role:WorkspaceRole.MEMBER}]}}});
await prisma.project.upsert({where:{id:projectId},update:{},create:{id:projectId,workspaceId:workspace.id,createdById:kayque.id,name:"Website Institucional",description:"Projeto demonstrativo inicial.",color:"#6c5ce7"}});
await prisma.$disconnect();
