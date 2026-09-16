import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const registerSchema=z.object({
  name:z.string().trim().min(2).max(120),
  email:z.string().trim().email().max(254),
  job:z.string().trim().min(2).max(120),
  password:z.string().min(8).max(128)
});
export const loginSchema=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(128)});
export const profileSchema=z.object({name:z.string().trim().min(2).max(120),job:z.string().trim().min(2).max(120),avatarKey:z.string().max(200).nullable().optional()});
export type SafeUser={id:string;email:string;name:string;job:string|null;avatarKey:string|null;workspaceId:string;workspaceName:string;role:"OWNER"|"ADMIN"|"MEMBER"};
type UserRecord=SafeUser&{passwordHash:string;sessionTokens:Set<string>};
export interface AuthRepository {
  findByEmail(email:string):Promise<UserRecord|undefined>;
  createUser(input:{name:string;email:string;job:string;passwordHash:string}):Promise<UserRecord>;
  createSession(userId:string,tokenHash:string,expiresAt:Date):Promise<void>;
  findSession(tokenHash:string):Promise<UserRecord|undefined>;
  revokeSession(tokenHash:string):Promise<void>;
  updateProfile(userId:string,input:{name:string;job:string;avatarKey?:string|null}):Promise<UserRecord>;
}

const hashToken=(token:string)=>crypto.createHash("sha256").update(token).digest("hex");
const newToken=()=>crypto.randomBytes(32).toString("base64url");
export const SESSION_COOKIE="taskflow_session";
export const SESSION_TTL_MS=1000*60*60*24*7;

export class AuthService {
  constructor(private readonly repository:AuthRepository,private readonly now=()=>new Date()) {}
  async register(input:unknown) {
    const data=registerSchema.parse(input),email=data.email.toLowerCase();
    if(await this.repository.findByEmail(email))throw new AuthError("EMAIL_IN_USE","Não foi possível criar a conta.",409);
    const passwordHash=await bcrypt.hash(data.password,12),user=await this.repository.createUser({...data,email,passwordHash});
    return this.startSession(user);
  }
  async login(input:unknown) {
    const data=loginSchema.parse(input),user=await this.repository.findByEmail(data.email.toLowerCase());
    if(!user||!(await bcrypt.compare(data.password,user.passwordHash)))throw new AuthError("INVALID_CREDENTIALS","E-mail ou senha inválidos.",401);
    return this.startSession(user);
  }
  async me(token:string|undefined) {
    if(!token)throw new AuthError("UNAUTHENTICATED","Sessão não encontrada.",401);
    const user=await this.repository.findSession(hashToken(token));
    if(!user)throw new AuthError("UNAUTHENTICATED","Sessão expirada ou inválida.",401);
    return {user:safeUser(user)};
  }
  async logout(token:string|undefined) { if(token)await this.repository.revokeSession(hashToken(token)); }
  async updateProfile(token:string|undefined,input:unknown) { if(!token)throw new AuthError("UNAUTHENTICATED","Sessão não encontrada.",401);const current=await this.repository.findSession(hashToken(token));if(!current)throw new AuthError("UNAUTHENTICATED","Sessão expirada ou inválida.",401);const data=profileSchema.parse(input);return {user:safeUser(await this.repository.updateProfile(current.id,data))}; }
  private async startSession(user:UserRecord) {
    const token=newToken(),expiresAt=new Date(this.now().getTime()+SESSION_TTL_MS);
    await this.repository.createSession(user.id,hashToken(token),expiresAt);
    return {token,expiresAt,user:safeUser(user)};
  }
}

export class AuthError extends Error { constructor(public readonly code:string,message:string,public readonly statusCode:number){super(message)} }
const safeUser=(user:UserRecord):SafeUser=>({id:user.id,email:user.email,name:user.name,job:user.job,avatarKey:user.avatarKey,workspaceId:user.workspaceId,workspaceName:user.workspaceName,role:user.role});

export class InMemoryAuthRepository implements AuthRepository {
  private users=new Map<string,UserRecord>();
  private sessions=new Map<string,{userId:string;expiresAt:Date}>();
  async findByEmail(email:string){return [...this.users.values()].find(user=>user.email===email);}
  async createUser(input:{name:string;email:string;job:string;passwordHash:string}) {
    const id=crypto.randomUUID(),user:UserRecord={id,email:input.email,name:input.name,job:input.job,avatarKey:null,workspaceId:crypto.randomUUID(),workspaceName:`Workspace de ${input.name.split(" ")[0]}`,role:"OWNER",passwordHash:input.passwordHash,sessionTokens:new Set()};
    this.users.set(id,user);return user;
  }
  async createSession(userId:string,tokenHash:string,expiresAt:Date){this.sessions.set(tokenHash,{userId,expiresAt})}
  async findSession(tokenHash:string){const session=this.sessions.get(tokenHash);if(!session||session.expiresAt<=new Date())return undefined;return this.users.get(session.userId)}
  async revokeSession(tokenHash:string){this.sessions.delete(tokenHash)}
  async updateProfile(userId:string,input:{name:string;job:string;avatarKey?:string|null}) { const user=this.users.get(userId);if(!user)throw new AuthError("UNAUTHENTICATED","Sessão expirada ou inválida.",401);user.name=input.name;user.job=input.job;user.avatarKey=input.avatarKey??null;return user; }
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma:PrismaClient) {}
  async findByEmail(email:string) {
    const user=await this.prisma.user.findUnique({where:{email},include:{credential:true,profile:true,memberships:{where:{status:"ACTIVE"},include:{workspace:true},orderBy:{createdAt:"asc"},take:1}}});
    const membership=user?.memberships[0];
    if(!user||!user.credential||!user.profile||!membership)return undefined;
    return {id:user.id,email:user.email,name:user.profile.name,job:user.profile.jobTitle,avatarKey:user.profile.avatarKey,workspaceId:membership.workspaceId,workspaceName:membership.workspace.name,role:membership.role,passwordHash:user.credential.passwordHash,sessionTokens:new Set<string>()};
  }
  async createUser(input:{name:string;email:string;job:string;passwordHash:string}) {
    const created=await this.prisma.$transaction(async tx=>{
      const user=await tx.user.create({data:{email:input.email,credential:{create:{passwordHash:input.passwordHash}},profile:{create:{name:input.name,jobTitle:input.job}},preferences:{create:{}}}});
      const workspace=await tx.workspace.create({data:{name:`Workspace de ${input.name.split(" ")[0]}`,ownerId:user.id,memberships:{create:{userId:user.id,role:"OWNER"}}}});
      return {user,workspace};
    });
    return {id:created.user.id,email:created.user.email,name:input.name,job:input.job,avatarKey:null,workspaceId:created.workspace.id,workspaceName:created.workspace.name,role:"OWNER" as const,passwordHash:input.passwordHash,sessionTokens:new Set<string>()};
  }
  async createSession(userId:string,tokenHash:string,expiresAt:Date){await this.prisma.session.create({data:{userId,tokenHash,expiresAt}})}
  async findSession(tokenHash:string){
    const session=await this.prisma.session.findFirst({where:{tokenHash,revokedAt:null,expiresAt:{gt:new Date()}},include:{user:{include:{credential:true,profile:true,memberships:{where:{status:"ACTIVE"},include:{workspace:true},orderBy:{createdAt:"asc"},take:1}}}}});
    const user=session?.user,membership=user?.memberships[0];
    if(!user||!user.credential||!user.profile||!membership)return undefined;
    return {id:user.id,email:user.email,name:user.profile.name,job:user.profile.jobTitle,avatarKey:user.profile.avatarKey,workspaceId:membership.workspaceId,workspaceName:membership.workspace.name,role:membership.role,passwordHash:user.credential.passwordHash,sessionTokens:new Set<string>()};
  }
  async revokeSession(tokenHash:string){await this.prisma.session.updateMany({where:{tokenHash,revokedAt:null},data:{revokedAt:new Date()}})}
  async updateProfile(userId:string,input:{name:string;job:string;avatarKey?:string|null}) { await this.prisma.profile.update({where:{userId},data:{name:input.name,jobTitle:input.job,avatarKey:input.avatarKey??null}});const user=await this.findByEmail((await this.prisma.user.findUniqueOrThrow({where:{id:userId}})).email);if(!user)throw new AuthError("UNAUTHENTICATED","Sessão expirada ou inválida.",401);return user; }
}
