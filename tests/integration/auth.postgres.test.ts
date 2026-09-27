import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../../server/app.js";
import { AuthService, PrismaAuthRepository } from "../../server/auth.js";
import { WorkspaceService } from "../../server/workspaces.js";
import { BusinessService } from "../../server/business.js";
import { seedDatabase } from "../../prisma/seed.js";
import { readEnvironment } from "../../server/config.js";

const testUrl=process.env.DATABASE_URL_TEST;
const enabled=Boolean(testUrl&&testUrl.toLowerCase().includes("test"));
const describePostgres=describe.skipIf(!enabled);

describePostgres("autenticação com PostgreSQL real",()=>{
  const prisma=enabled&&testUrl?new PrismaClient({datasources:{db:{url:testUrl}}}):null;
  const environment=readEnvironment({NODE_ENV:"test",DATABASE_URL:testUrl??"postgresql://test:test@localhost/test"});
  let app:ReturnType<typeof buildApp>;
  let authService:AuthService;
  let service:WorkspaceService;
  let business:BusinessService;
  let owner:Awaited<ReturnType<AuthService["register"]>>;
  let admin:Awaited<ReturnType<AuthService["register"]>>;
  let member:Awaited<ReturnType<AuthService["register"]>>;
  let outsider:Awaited<ReturnType<AuthService["register"]>>;
  const cookie=(session:{token:string})=>`taskflow_session=${encodeURIComponent(app.signCookie(session.token))}`;
  beforeAll(async()=>{
    if(!testUrl||!testUrl.toLowerCase().includes("test"))throw new Error("DATABASE_URL_TEST deve apontar para banco exclusivo de testes.");
    await prisma!.$executeRawUnsafe('TRUNCATE TABLE "Session", "Notification", "UserPreference", "Activity", "Comment", "TaskAssignee", "Task", "Project", "Invitation", "Membership", "Workspace", "Profile", "Credential", "User" CASCADE');
    authService=new AuthService(new PrismaAuthRepository(prisma!));service=new WorkspaceService(prisma!,environment.APP_ORIGIN);business=new BusinessService(prisma!);
    app=buildApp(environment,authService,service,business);
    owner=await authService.register({name:"Owner Teste",email:"owner@test.example",job:"Gestor",password:"senha-segura"});
    admin=await authService.register({name:"Admin Teste",email:"admin@test.example",job:"Designer",password:"senha-segura"});
    member=await authService.register({name:"Member Teste",email:"member@test.example",job:"Analista",password:"senha-segura"});
    outsider=await authService.register({name:"Outsider Teste",email:"outsider@test.example",job:"QA",password:"senha-segura"});
  });
  afterAll(async()=>{await app?.close();await prisma?.$disconnect()});
  it("persiste cadastro, perfil, workspace, membership, sessão, login e revogação",async()=>{
    const register=await app.inject({method:"POST",url:"/api/auth/register",payload:{name:"Integração PostgreSQL",email:"pg@example.com",job:"QA",password:"senha-segura"}});
    expect(register.statusCode).toBe(201);expect(register.json().data.user).not.toHaveProperty("passwordHash");
    const setCookie=register.headers["set-cookie"],cookie=(Array.isArray(setCookie)?setCookie[0]:setCookie)?.split(";")[0];expect(cookie).toBeTruthy();
    const user=await prisma!.user.findUnique({where:{email:"pg@example.com"},include:{credential:true,profile:true,memberships:true,sessions:true}});
    expect(user?.credential?.passwordHash).toBeTruthy();expect(user?.profile?.name).toBe("Integração PostgreSQL");expect(user?.memberships[0]?.role).toBe("OWNER");expect(user?.sessions).toHaveLength(1);
    const me=await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}});expect(me.statusCode).toBe(200);expect(me.json().data.user.name).toBe("Integração PostgreSQL");
    const profile=await app.inject({method:"PATCH",url:"/api/auth/me",headers:{cookie},payload:{name:"caio",job:"Designer",avatarKey:"suggested:1"}});
    expect(profile.statusCode).toBe(200);expect(profile.json().data.user.name).toBe("caio");
    expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}})).json().data.user.name).toBe("caio");
    const login=await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"PG@EXAMPLE.COM",password:"senha-segura"}});expect(login.statusCode).toBe(200);
    const logout=await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie}});expect(logout.statusCode).toBe(200);
    expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}})).statusCode).toBe(401);
    expect((await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie}})).statusCode).toBe(200);
    expect((await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"pg@example.com",password:"errada"}})).statusCode).toBe(401);
  });

  it("mantém o seed demonstrativo idempotente",async()=>{
    await seedDatabase(prisma!);await seedDatabase(prisma!);
    expect(await prisma!.project.count({where:{workspaceId:"00000000-0000-4000-8000-000000000101"}})).toBe(3);
    expect(await prisma!.task.count({where:{workspaceId:"00000000-0000-4000-8000-000000000101"}})).toBe(6);
    expect(await prisma!.taskAssignee.count({where:{task:{workspaceId:"00000000-0000-4000-8000-000000000101"}}})).toBe(6);
  });

  describe("workspaces, membros e convites",()=>{
    let workspaceId:string;
    const invite=async(email:string,role:"ADMIN"|"MEMBER"="MEMBER")=>{
      const result=await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/invitations`,headers:{cookie:cookie(owner)},payload:{email,role,workspaceJob:"Função local"}});
      expect(result.statusCode).toBe(201);
      return result.json().data as {id:string;link:string};
    };
    beforeEach(async()=>{
      const workspace=await service.create(owner.user.id,{name:"Equipe Integrada"});workspaceId=workspace.id;
      const adminInvite=await service.createInvitation(owner.user.id,workspaceId,{email:admin.user.email,role:"ADMIN"});
      await service.acceptInvitation(admin.user.id,admin.user.email,adminInvite.link.split("/").pop()!);
      const memberInvite=await service.createInvitation(owner.user.id,workspaceId,{email:member.user.email,role:"MEMBER"});
      await service.acceptInvitation(member.user.id,member.user.email,memberInvite.link.split("/").pop()!);
    });

    it("lista apenas workspaces acessíveis, cria OWNER e isola IDs alheios",async()=>{
      const mine=await app.inject({method:"GET",url:"/api/workspaces",headers:{cookie:cookie(owner)}});
      expect(mine.json().data.some((item:{id:string})=>item.id===workspaceId)).toBe(true);
      const foreign=await app.inject({method:"GET",url:"/api/workspaces",headers:{cookie:cookie(outsider)}});
      expect(foreign.json().data.some((item:{id:string})=>item.id===workspaceId)).toBe(false);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(404);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/members`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(404);
      const created=await app.inject({method:"POST",url:"/api/workspaces",headers:{cookie:cookie(owner)},payload:{name:"Outro workspace"}});
      expect(created.statusCode).toBe(201);expect(created.json().data.role).toBe("OWNER");
      expect(await prisma!.membership.findUnique({where:{workspaceId_userId:{workspaceId:created.json().data.id,userId:owner.user.id}}})).toMatchObject({role:"OWNER"});
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}`,headers:{cookie:cookie(owner)}})).statusCode).toBe(409);
    });

    it("permite leitura para MEMBER e administração restrita para ADMIN",async()=>{
      const list=await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/members`,headers:{cookie:cookie(member)}});
      expect(list.statusCode).toBe(200);expect(list.json().data).toHaveLength(3);
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/members/${admin.user.id}`,headers:{cookie:cookie(member)},payload:{workspaceJob:"Chefe"}})).statusCode).toBe(403);
      const edit=await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/members/${member.user.id}`,headers:{cookie:cookie(admin)},payload:{workspaceJob:"Função de equipe"}});
      expect(edit.statusCode).toBe(200);expect(edit.json().data.workspaceJob).toBe("Função de equipe");
      expect((await prisma!.profile.findUnique({where:{userId:member.user.id}}))?.jobTitle).toBe("Analista");
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/members/${owner.user.id}`,headers:{cookie:cookie(admin)},payload:{role:"MEMBER"}})).statusCode).toBe(403);
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/members/${owner.user.id}`,headers:{cookie:cookie(owner)},payload:{status:"BLOCKED"}})).statusCode).toBe(403);
    });

    it("bloqueio corta acesso e desbloqueio o restaura",async()=>{
      const path=`/api/workspaces/${workspaceId}/members/${member.user.id}`;
      expect((await app.inject({method:"PATCH",url:path,headers:{cookie:cookie(admin)},payload:{status:"BLOCKED"}})).statusCode).toBe(200);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}`,headers:{cookie:cookie(member)}})).statusCode).toBe(403);
      const listed=await app.inject({method:"GET",url:"/api/workspaces",headers:{cookie:cookie(member)}});
      expect(listed.json().data.some((item:{id:string})=>item.id===workspaceId)).toBe(false);
      expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie:cookie(member)}})).statusCode).toBe(200);
      expect((await app.inject({method:"PATCH",url:path,headers:{cookie:cookie(admin)},payload:{status:"ACTIVE"}})).statusCode).toBe(200);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}`,headers:{cookie:cookie(member)}})).statusCode).toBe(200);
    });

    it("remoção preserva conta pessoal e impede autogerenciamento",async()=>{
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/members/${owner.user.id}`,headers:{cookie:cookie(owner)}})).statusCode).toBe(403);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/members/${admin.user.id}`,headers:{cookie:cookie(admin)}})).statusCode).toBe(403);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/members/${member.user.id}`,headers:{cookie:cookie(admin)}})).statusCode).toBe(200);
      expect(await prisma!.membership.findUnique({where:{workspaceId_userId:{workspaceId,userId:member.user.id}}})).toBeNull();
      expect(await prisma!.user.findUnique({where:{id:member.user.id}})).toBeTruthy();
      expect(await prisma!.profile.findUnique({where:{userId:member.user.id}})).toBeTruthy();
      expect((await app.inject({method:"GET",url:`/api/workspaces/${member.user.workspaceId}`,headers:{cookie:cookie(member)}})).statusCode).toBe(200);
    });

    it("transfere propriedade em transação e mantém gestor ativo",async()=>{
      const result=await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/transfer-ownership`,headers:{cookie:cookie(owner)},payload:{userId:admin.user.id}});
      expect(result.statusCode).toBe(200);expect(result.json().data.ownerId).toBe(admin.user.id);
      expect((await prisma!.workspace.findUnique({where:{id:workspaceId}}))?.ownerId).toBe(admin.user.id);
      expect((await prisma!.membership.findUnique({where:{workspaceId_userId:{workspaceId,userId:owner.user.id}}}))?.role).toBe("ADMIN");
      expect((await prisma!.membership.findUnique({where:{workspaceId_userId:{workspaceId,userId:admin.user.id}}}))?.role).toBe("OWNER");
      expect(await prisma!.activity.count({where:{workspaceId,type:"OWNERSHIP_TRANSFERRED"}})).toBe(1);
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/members/${admin.user.id}`,headers:{cookie:cookie(owner)},payload:{role:"MEMBER"}})).statusCode).toBe(403);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/members/${admin.user.id}`,headers:{cookie:cookie(admin)}})).statusCode).toBe(403);
    });

    it("aceita convite válido uma vez e recusa e-mail divergente e membro existente",async()=>{
      const invitation=await invite(outsider.user.email);
      const token=invitation.link.split("/").pop()!;
      expect((await app.inject({method:"POST",url:`/api/invitations/${token}/accept`,headers:{cookie:cookie(member)}})).statusCode).toBe(403);
      expect((await app.inject({method:"POST",url:`/api/invitations/${token}/accept`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(200);
      expect((await app.inject({method:"POST",url:`/api/invitations/${token}/accept`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(409);
      expect((await prisma!.membership.findUnique({where:{workspaceId_userId:{workspaceId,userId:outsider.user.id}}}))?.role).toBe("MEMBER");
      expect((await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/invitations`,headers:{cookie:cookie(owner)},payload:{email:member.user.email}})).statusCode).toBe(409);
    });

    it("recusa convite expirado e revogado",async()=>{
      const expired=await invite(outsider.user.email);
      await prisma!.invitation.update({where:{id:expired.id},data:{expiresAt:new Date(0)}});
      expect((await app.inject({method:"POST",url:`/api/invitations/${expired.link.split("/").pop()}/accept`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(410);
      await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/invitations`,headers:{cookie:cookie(owner)}});
      expect((await prisma!.invitation.findUnique({where:{id:expired.id}}))?.status).toBe("EXPIRED");
      const revoked=await invite(outsider.user.email);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/invitations/${revoked.id}`,headers:{cookie:cookie(owner)}})).statusCode).toBe(200);
      expect((await app.inject({method:"POST",url:`/api/invitations/${revoked.link.split("/").pop()}/accept`,headers:{cookie:cookie(outsider)}})).statusCode).toBe(410);
    });
  });

  describe("projetos, tarefas e atividades",()=>{
    let workspaceId:string,projectId:string;
    beforeEach(async()=>{
      const workspace=await service.create(owner.user.id,{name:"Negócio real"});workspaceId=workspace.id;
      for(const target of [{session:admin,role:"ADMIN" as const},{session:member,role:"MEMBER" as const}]){const invitation=await service.createInvitation(owner.user.id,workspaceId,{email:target.session.user.email,role:target.role});await service.acceptInvitation(target.session.user.id,target.session.user.email,invitation.link.split("/").pop()!)}
      const project=await business.createProject(owner.user.id,workspaceId,{name:"Projeto API",description:"Persistido",color:"#6c5ce7",start:"2026-09-25",due:"2026-10-30",memberIds:[owner.user.id,member.user.id]});projectId=project.id;
    });

    it("faz CRUD de projeto, calcula progresso e impede exclusão com tarefas",async()=>{
      const updated=await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/projects/${projectId}`,headers:{cookie:cookie(owner)},payload:{name:"Projeto atualizado",status:"ACTIVE"}});
      expect(updated.statusCode).toBe(200);expect(updated.json().data.name).toBe("Projeto atualizado");
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/projects/${projectId}`,headers:{cookie:cookie(member)},payload:{name:"Inválido"}})).statusCode).toBe(403);
      const task=await business.createTask(owner.user.id,workspaceId,{projectId,title:"Entrega",description:"Teste",status:"COMPLETED",priority:"HIGH",due:"2026-10-01",assigneeIds:[member.user.id]});
      const tasks=(await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(owner)}})).json().data;
      expect(tasks.filter((item:{projectId:string;status:string})=>item.projectId===projectId&&item.status==="COMPLETED")).toHaveLength(1);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/projects/${projectId}`,headers:{cookie:cookie(owner)}})).statusCode).toBe(409);
      await business.deleteTask(owner.user.id,workspaceId,task.id);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/projects/${projectId}`,headers:{cookie:cookie(owner)}})).statusCode).toBe(200);
    });

    it("aplica regras de MEMBER e registra alterações da tarefa",async()=>{
      const created=await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(member)},payload:{projectId,title:"Criada pelo membro",description:"Real",priority:"MEDIUM",status:"PENDING",due:"2026-10-02",assigneeIds:[member.user.id]}});
      expect(created.statusCode).toBe(201);const taskId=created.json().data.id;
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/tasks/${taskId}`,headers:{cookie:cookie(member)},payload:{status:"COMPLETED"}})).statusCode).toBe(200);
      expect((await app.inject({method:"PATCH",url:`/api/workspaces/${workspaceId}/tasks/${taskId}`,headers:{cookie:cookie(member)},payload:{priority:"HIGH"}})).statusCode).toBe(403);
      expect((await app.inject({method:"DELETE",url:`/api/workspaces/${workspaceId}/tasks/${taskId}`,headers:{cookie:cookie(member)}})).statusCode).toBe(403);
      const activity=(await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/activities?userId=${member.user.id}`,headers:{cookie:cookie(owner)}})).json().data;
      expect(activity.some((item:{type:string})=>item.type==="TASK_COMPLETED")).toBe(true);
    });

    it("isola workspaces, projetos e responsáveis bloqueados ou externos",async()=>{
      const foreignProject=await business.createProject(outsider.user.id,outsider.user.workspaceId!,{name:"Externo",description:"",color:"#123456",memberIds:[outsider.user.id]});
      const payload={projectId:foreignProject.id,title:"Referência cruzada",description:"",priority:"LOW",status:"PENDING",due:null,assigneeIds:[member.user.id]};
      expect((await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(owner)},payload})).statusCode).toBe(400);
      expect((await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(owner)},payload:{...payload,projectId,assigneeIds:[outsider.user.id]}})).statusCode).toBe(400);
      await service.patchMember(owner.user.id,workspaceId,member.user.id,{status:"BLOCKED"});
      expect((await app.inject({method:"POST",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(owner)},payload:{...payload,projectId,assigneeIds:[member.user.id]}})).statusCode).toBe(400);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/tasks`,headers:{cookie:cookie(member)}})).statusCode).toBe(403);
      await service.patchMember(owner.user.id,workspaceId,member.user.id,{status:"ACTIVE"});
      await service.removeMember(owner.user.id,workspaceId,member.user.id);
      expect((await app.inject({method:"GET",url:`/api/workspaces/${workspaceId}/projects`,headers:{cookie:cookie(member)}})).statusCode).toBe(404);
    });

    it("filtra por status, prioridade, responsável, projeto, período, busca e minhas tarefas",async()=>{
      await business.createTask(owner.user.id,workspaceId,{projectId,title:"Pesquisar relatório",description:"Indicador",status:"IN_PROGRESS",priority:"HIGH",due:"2026-10-05",assigneeIds:[member.user.id]});
      await business.createTask(owner.user.id,workspaceId,{projectId,title:"Outra entrega",description:"",status:"PENDING",priority:"LOW",due:"2026-11-05",assigneeIds:[admin.user.id]});
      const url=`/api/workspaces/${workspaceId}/tasks?status=IN_PROGRESS&priority=HIGH&assigneeId=${member.user.id}&projectId=${projectId}&from=2026-10-01&to=2026-10-31&q=relat%C3%B3rio&mine=true`;
      const result=await app.inject({method:"GET",url,headers:{cookie:cookie(member)}});
      expect(result.statusCode).toBe(200);expect(result.json().data).toHaveLength(1);expect(result.json().data[0].title).toBe("Pesquisar relatório");
    });
  });
});
