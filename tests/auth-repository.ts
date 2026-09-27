import crypto from "node:crypto";
import { AuthError, type AuthRepository, type UserRecord } from "../server/auth.js";
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

