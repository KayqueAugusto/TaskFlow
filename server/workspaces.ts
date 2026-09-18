import crypto from "node:crypto";
import { Prisma, PrismaClient, WorkspaceRole } from "@prisma/client";
import { z } from "zod";

export class WorkspaceError extends Error {
  constructor(public readonly code:string,message:string,public readonly statusCode:number){super(message)}
}

const uuid=z.string().uuid();
const name=z.string().trim().min(2).max(120);
const workspaceInput=z.object({name});
const memberInput=z.object({workspaceJob:z.string().trim().max(120).nullable().optional(),role:z.enum(["ADMIN","MEMBER"]).optional(),status:z.enum(["ACTIVE","BLOCKED"]).optional()}).refine(value=>Object.keys(value).length>0);
const inviteInput=z.object({email:z.string().trim().email().max(254),role:z.enum(["ADMIN","MEMBER"]).default("MEMBER"),workspaceJob:z.string().trim().max(120).nullable().optional()});
const fail=(code:string,message:string,statusCode=403):never=>{throw new WorkspaceError(code,message,statusCode)};
const tokenHash=(token:string)=>crypto.createHash("sha256").update(token).digest("hex");

export class WorkspaceService {
  constructor(private readonly prisma:PrismaClient,private readonly webOrigin:string,private readonly now=()=>new Date()){}

  async list(userId:string){
    const rows=await this.prisma.membership.findMany({where:{userId,status:"ACTIVE"},include:{workspace:true},orderBy:{createdAt:"asc"}});
    return rows.map(row=>({id:row.workspaceId,name:row.workspace.name,ownerId:row.workspace.ownerId,role:row.role,status:row.status,createdAt:row.workspace.createdAt}));
  }

  async get(userId:string,workspaceId:string){
    const member=await this.requireMembership(this.prisma,userId,uuid.parse(workspaceId));
    return {id:member.workspaceId,name:member.workspace.name,ownerId:member.workspace.ownerId,role:member.role,status:member.status,createdAt:member.workspace.createdAt};
  }

  async create(userId:string,input:unknown){
    const data=workspaceInput.parse(input);
    const workspace=await this.prisma.workspace.create({data:{name:data.name,ownerId:userId,memberships:{create:{userId,role:"OWNER"}}}});
    return {id:workspace.id,name:workspace.name,ownerId:userId,role:"OWNER" as const,status:"ACTIVE" as const,createdAt:workspace.createdAt};
  }

  async update(userId:string,workspaceId:string,input:unknown){
    const data=workspaceInput.parse(input),id=uuid.parse(workspaceId);
    const member=await this.requireMembership(this.prisma,userId,id);
    if(member.role!=="OWNER")fail("FORBIDDEN","Somente o proprietário pode editar o workspace.");
    const workspace=await this.prisma.workspace.update({where:{id},data:{name:data.name}});
    return {id:workspace.id,name:workspace.name,ownerId:workspace.ownerId,role:member.role,status:member.status,createdAt:workspace.createdAt};
  }

  async removeWorkspace(userId:string,workspaceId:string){
    const member=await this.requireMembership(this.prisma,userId,uuid.parse(workspaceId));
    if(member.role!=="OWNER")fail("FORBIDDEN","Somente o proprietário pode excluir o workspace.");
    fail("WORKSPACE_DELETE_UNAVAILABLE","Exclusão de workspace indisponível até a migração de projetos e tarefas.",409);
  }

  async members(userId:string,workspaceId:string){
    const id=uuid.parse(workspaceId);
    await this.requireMembership(this.prisma,userId,id);
    const rows=await this.prisma.membership.findMany({where:{workspaceId:id},include:{user:{include:{profile:true}}},orderBy:{createdAt:"asc"}});
    return rows.map(row=>this.memberView(row));
  }

  async patchMember(actorId:string,workspaceId:string,memberId:string,input:unknown){
    const id=uuid.parse(workspaceId),targetId=uuid.parse(memberId),data=memberInput.parse(input);
    return this.prisma.$transaction(async tx=>{
      const actor=await this.requireManager(tx,actorId,id);
      const target=await tx.membership.findUnique({where:{workspaceId_userId:{workspaceId:id,userId:targetId}},include:{user:{include:{profile:true}}}});
      if(!target)return fail("MEMBER_NOT_FOUND","Membro não encontrado.",404);
      if(actor.role==="ADMIN"&&(target.role!=="MEMBER"||targetId===actorId))fail("FORBIDDEN","Administrador só pode gerenciar membros comuns.");
      if(target.role==="OWNER"&&(data.role||data.status==="BLOCKED"))fail("OWNER_PROTECTED","O proprietário não pode ser bloqueado ou rebaixado.");
      if(targetId===actorId&&(data.role||data.status==="BLOCKED"))fail("SELF_MANAGEMENT","Não é permitido alterar o próprio acesso.");
      if(target.role==="ADMIN"&&(data.role==="MEMBER"||data.status==="BLOCKED"))await this.ensureManagerRemains(tx,id,targetId);
      const updated=await tx.membership.update({where:{workspaceId_userId:{workspaceId:id,userId:targetId}},data:{workspaceJob:data.workspaceJob,role:data.role,status:data.status},include:{user:{include:{profile:true}}}});
      await tx.activity.create({data:{workspaceId:id,actorId,type:"MEMBER_UPDATED",payload:{userId:targetId,role:updated.role,status:updated.status}}});
      return this.memberView(updated);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async removeMember(actorId:string,workspaceId:string,memberId:string){
    const id=uuid.parse(workspaceId),targetId=uuid.parse(memberId);
    return this.prisma.$transaction(async tx=>{
      const actor=await this.requireManager(tx,actorId,id);
      const target=await tx.membership.findUnique({where:{workspaceId_userId:{workspaceId:id,userId:targetId}}});
      if(!target)return fail("MEMBER_NOT_FOUND","Membro não encontrado.",404);
      if(target.role==="OWNER")fail("OWNER_PROTECTED","Transfira a propriedade antes de remover o proprietário.");
      if(targetId===actorId)fail("SELF_MANAGEMENT","Não é permitido remover a si próprio.");
      if(actor.role==="ADMIN"&&target.role!=="MEMBER")fail("FORBIDDEN","Administrador só pode remover membros comuns.");
      if(target.role==="ADMIN"&&target.status==="ACTIVE")await this.ensureManagerRemains(tx,id,targetId);
      await tx.membership.delete({where:{workspaceId_userId:{workspaceId:id,userId:targetId}}});
      await tx.activity.create({data:{workspaceId:id,actorId,type:"MEMBER_REMOVED",payload:{userId:targetId}}});
      return {removed:true};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async transfer(actorId:string,workspaceId:string,input:unknown){
    const id=uuid.parse(workspaceId),data=z.object({userId:uuid}).parse(input);
    return this.prisma.$transaction(async tx=>{
      const actor=await this.requireMembership(tx,actorId,id);
      if(actor.role!=="OWNER"||actor.workspace.ownerId!==actorId)fail("FORBIDDEN","Somente o proprietário atual pode transferir o workspace.");
      if(data.userId===actorId)fail("INVALID_TARGET","Escolha outro membro.",400);
      const target=await tx.membership.findUnique({where:{workspaceId_userId:{workspaceId:id,userId:data.userId}}});
      if(!target||target.status!=="ACTIVE")fail("INVALID_TARGET","O novo proprietário deve ser membro ativo.",400);
      await tx.workspace.update({where:{id},data:{ownerId:data.userId}});
      await tx.membership.update({where:{workspaceId_userId:{workspaceId:id,userId:actorId}},data:{role:"ADMIN"}});
      await tx.membership.update({where:{workspaceId_userId:{workspaceId:id,userId:data.userId}},data:{role:"OWNER"}});
      await tx.activity.create({data:{workspaceId:id,actorId,type:"OWNERSHIP_TRANSFERRED",payload:{fromUserId:actorId,toUserId:data.userId}}});
      return {ownerId:data.userId,previousOwnerId:actorId};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async invitations(actorId:string,workspaceId:string){
    const id=uuid.parse(workspaceId);
    await this.requireManager(this.prisma,actorId,id);
    await this.prisma.invitation.updateMany({where:{workspaceId:id,status:"PENDING",expiresAt:{lte:this.now()}},data:{status:"EXPIRED"}});
    return this.prisma.invitation.findMany({where:{workspaceId:id},select:{id:true,email:true,role:true,workspaceJob:true,status:true,expiresAt:true,createdAt:true},orderBy:{createdAt:"desc"}});
  }

  async createInvitation(actorId:string,workspaceId:string,input:unknown){
    const id=uuid.parse(workspaceId),data=inviteInput.parse(input),email=data.email.toLowerCase();
    await this.requireManager(this.prisma,actorId,id);
    const existing=await this.prisma.membership.findFirst({where:{workspaceId:id,user:{email}}});
    if(existing)fail("ALREADY_MEMBER","Esta pessoa já pertence ao workspace.",409);
    const pending=await this.prisma.invitation.findFirst({where:{workspaceId:id,email,status:"PENDING",expiresAt:{gt:this.now()}}});
    if(pending)fail("INVITATION_PENDING","Revogue o convite pendente antes de gerar outro.",409);
    const token=crypto.randomBytes(32).toString("base64url");
    const invitation=await this.prisma.invitation.create({data:{workspaceId:id,email,role:data.role,workspaceJob:data.workspaceJob,tokenHash:tokenHash(token),expiresAt:new Date(this.now().getTime()+7*24*60*60*1000)}});
    await this.prisma.activity.create({data:{workspaceId:id,actorId,type:"INVITATION_CREATED",payload:{invitationId:invitation.id,email}}});
    return {id:invitation.id,email,role:invitation.role,workspaceJob:invitation.workspaceJob,status:invitation.status,expiresAt:invitation.expiresAt,link:`${this.webOrigin.replace(/\/$/,"")}/invite/${token}`};
  }

  async revokeInvitation(actorId:string,workspaceId:string,invitationId:string){
    const id=uuid.parse(workspaceId),targetId=uuid.parse(invitationId);
    await this.requireManager(this.prisma,actorId,id);
    const result=await this.prisma.invitation.updateMany({where:{id:targetId,workspaceId:id,status:"PENDING"},data:{status:"REVOKED"}});
    if(!result.count)fail("INVITATION_NOT_FOUND","Convite pendente não encontrado.",404);
    await this.prisma.activity.create({data:{workspaceId:id,actorId,type:"INVITATION_REVOKED",payload:{invitationId:targetId}}});
    return {revoked:true};
  }

  async acceptInvitation(userId:string,email:string,token:string){
    if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))fail("INVITATION_NOT_FOUND","Convite não encontrado.",404);
    const hash=tokenHash(token);
    await this.prisma.invitation.updateMany({where:{tokenHash:hash,status:"PENDING",expiresAt:{lte:this.now()}},data:{status:"EXPIRED"}});
    return this.prisma.$transaction(async tx=>{
      const invitation=await tx.invitation.findUnique({where:{tokenHash:hash}});
      if(!invitation)return fail("INVITATION_NOT_FOUND","Convite não encontrado.",404);
      if(invitation.status==="REVOKED"||invitation.status==="EXPIRED")fail("INVITATION_UNAVAILABLE","Convite expirado ou revogado.",410);
      if(invitation.status!=="PENDING")fail("INVITATION_USED","Convite já utilizado.",409);
      if(invitation.expiresAt<=this.now())fail("INVITATION_UNAVAILABLE","Convite expirado.",410);
      if(invitation.email!==email.toLowerCase())fail("INVITATION_EMAIL_MISMATCH","Entre com o e-mail convidado.");
      const existing=await tx.membership.findUnique({where:{workspaceId_userId:{workspaceId:invitation.workspaceId,userId}}});
      if(existing)fail("ALREADY_MEMBER","Esta conta já pertence ao workspace.",409);
      const claimed=await tx.invitation.updateMany({where:{id:invitation.id,status:"PENDING"},data:{status:"ACCEPTED"}});
      if(!claimed.count)fail("INVITATION_USED","Convite já utilizado.",409);
      await tx.membership.create({data:{workspaceId:invitation.workspaceId,userId,role:invitation.role,workspaceJob:invitation.workspaceJob}});
      await tx.activity.create({data:{workspaceId:invitation.workspaceId,actorId:userId,type:"INVITATION_ACCEPTED",payload:{invitationId:invitation.id}}});
      return {workspaceId:invitation.workspaceId,role:invitation.role};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async requireMembership(db:Prisma.TransactionClient,userId:string,workspaceId:string){
    const member=await db.membership.findUnique({where:{workspaceId_userId:{workspaceId,userId}},include:{workspace:true}});
    if(!member)return fail("WORKSPACE_NOT_FOUND","Workspace não encontrado.",404);
    if(member.status==="BLOCKED")fail("WORKSPACE_BLOCKED","Acesso bloqueado neste workspace.");
    return member;
  }

  private async requireManager(db:Prisma.TransactionClient,userId:string,workspaceId:string){
    const member=await this.requireMembership(db,userId,workspaceId);
    if(member.role===WorkspaceRole.MEMBER)fail("FORBIDDEN","Permissão administrativa necessária.");
    return member;
  }

  private async ensureManagerRemains(db:Prisma.TransactionClient,workspaceId:string,excludingUserId:string){
    const count=await db.membership.count({where:{workspaceId,status:"ACTIVE",role:{in:["OWNER","ADMIN"]},userId:{not:excludingUserId}}});
    if(count<1)fail("LAST_MANAGER","O workspace precisa manter um administrador ativo.",409);
  }

  private memberView(row:{userId:string;workspaceId:string;role:WorkspaceRole;status:"ACTIVE"|"BLOCKED";workspaceJob:string|null;user:{email:string;profile:{name:string;jobTitle:string|null;avatarKey:string|null}|null}}){
    return {id:row.userId,userId:row.userId,workspaceId:row.workspaceId,email:row.user.email,name:row.user.profile?.name??"",job:row.user.profile?.jobTitle??null,workspaceJob:row.workspaceJob,avatarKey:row.user.profile?.avatarKey??null,role:row.role,status:row.status};
  }
}
