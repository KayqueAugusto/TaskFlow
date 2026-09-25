import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { Environment } from "./config.js";
import { AuthError, AuthService, InMemoryAuthRepository, SESSION_COOKIE } from "./auth.js";
import { WorkspaceError, WorkspaceService } from "./workspaces.js";
import { BusinessService } from "./business.js";

export function buildApp(environment:Environment,authService=new AuthService(new InMemoryAuthRepository()),workspaces?:WorkspaceService,business?:BusinessService) {
  const app=Fastify({logger:environment.NODE_ENV!=="test"});
  app.register(cors,{origin:environment.WEB_ORIGIN,credentials:true,methods:["GET","HEAD","POST","PATCH","DELETE"]});
  app.register(cookie);
  app.register(rateLimit,{max:100,timeWindow:"1 minute"});
  app.get("/api/health",async()=>({data:{status:"ok",service:"taskflow-api"}}));

  const setSession=(reply:FastifyReply,session:{token:string;expiresAt:Date})=>reply.setCookie(SESSION_COOKIE,session.token,{httpOnly:true,sameSite:environment.NODE_ENV==="production"?"strict":"lax",secure:environment.NODE_ENV==="production",expires:session.expiresAt,path:"/"});
  app.post("/api/auth/register",{config:{rateLimit:{max:5,timeWindow:"15 minutes"}}},async(request,reply)=>{
    try { const session=await authService.register(request.body);setSession(reply,session);return reply.code(201).send({data:{user:session.user}}); }
    catch(error){return handleAuthError(error,reply)}
  });
  app.post("/api/auth/login",{config:{rateLimit:{max:10,timeWindow:"15 minutes"}}},async(request,reply)=>{
    try { const session=await authService.login(request.body);setSession(reply,session);return reply.send({data:{user:session.user}}); }
    catch(error){return handleAuthError(error,reply)}
  });
  app.get("/api/auth/me",async(request,reply)=>{
    try { const result=await authService.me(request.cookies[SESSION_COOKIE]);return reply.send({data:result}); }
    catch(error){return handleAuthError(error,reply)}
  });
  app.patch("/api/auth/me",async(request,reply)=>{
    try { return reply.send({data:await authService.updateProfile(request.cookies[SESSION_COOKIE],request.body)}); }
    catch(error){return handleAuthError(error,reply)}
  });
  app.post("/api/auth/logout",async(request,reply)=>{
    await authService.logout(request.cookies[SESSION_COOKIE]);
    return reply.clearCookie(SESSION_COOKIE,{httpOnly:true,sameSite:environment.NODE_ENV==="production"?"strict":"lax",secure:environment.NODE_ENV==="production",path:"/"}).send({data:{loggedOut:true}});
  });
  if(workspaces){
    const actor=async(token:string|undefined)=>(await authService.me(token)).user;
    app.get("/api/workspaces",async request=>({data:await workspaces.list((await actor(request.cookies[SESSION_COOKIE])).id)}));
    app.post("/api/workspaces",async(request,reply)=>reply.code(201).send({data:await workspaces.create((await actor(request.cookies[SESSION_COOKIE])).id,request.body)}));
    app.get<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId",async request=>({data:await workspaces.get((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId)}));
    app.patch<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId",async request=>({data:await workspaces.update((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.body)}));
    app.delete<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId",async request=>({data:await workspaces.removeWorkspace((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId)}));
    app.get<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/members",async request=>({data:await workspaces.members((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId)}));
    app.patch<{Params:{workspaceId:string;membershipId:string}}>("/api/workspaces/:workspaceId/members/:membershipId",async request=>({data:await workspaces.patchMember((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.membershipId,request.body)}));
    app.delete<{Params:{workspaceId:string;membershipId:string}}>("/api/workspaces/:workspaceId/members/:membershipId",async request=>({data:await workspaces.removeMember((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.membershipId)}));
    app.post<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/transfer-ownership",async request=>({data:await workspaces.transfer((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.body)}));
    app.get<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/invitations",async request=>({data:await workspaces.invitations((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId)}));
    app.post<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/invitations",async(request,reply)=>reply.code(201).send({data:await workspaces.createInvitation((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.body)}));
    app.delete<{Params:{workspaceId:string;invitationId:string}}>("/api/workspaces/:workspaceId/invitations/:invitationId",async request=>({data:await workspaces.revokeInvitation((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.invitationId)}));
    app.post<{Params:{token:string}}>("/api/invitations/:token/accept",async request=>{const user=await actor(request.cookies[SESSION_COOKIE]);return {data:await workspaces.acceptInvitation(user.id,user.email,request.params.token)};});
  }
  if(business){
    const actor=async(token:string|undefined)=>(await authService.me(token)).user;
    app.get<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/projects",async request=>({data:await business.projects((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId)}));
    app.post<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/projects",async(request,reply)=>reply.code(201).send({data:await business.createProject((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.body)}));
    app.get<{Params:{workspaceId:string;projectId:string}}>("/api/workspaces/:workspaceId/projects/:projectId",async request=>({data:await business.project((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.projectId)}));
    app.patch<{Params:{workspaceId:string;projectId:string}}>("/api/workspaces/:workspaceId/projects/:projectId",async request=>({data:await business.updateProject((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.projectId,request.body)}));
    app.delete<{Params:{workspaceId:string;projectId:string}}>("/api/workspaces/:workspaceId/projects/:projectId",async request=>({data:await business.deleteProject((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.projectId)}));
    app.get<{Params:{workspaceId:string};Querystring:Record<string,string>}>("/api/workspaces/:workspaceId/tasks",async request=>({data:await business.tasks((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.query)}));
    app.post<{Params:{workspaceId:string}}>("/api/workspaces/:workspaceId/tasks",async(request,reply)=>reply.code(201).send({data:await business.createTask((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.body)}));
    app.get<{Params:{workspaceId:string;taskId:string}}>("/api/workspaces/:workspaceId/tasks/:taskId",async request=>({data:await business.task((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.taskId)}));
    app.patch<{Params:{workspaceId:string;taskId:string}}>("/api/workspaces/:workspaceId/tasks/:taskId",async request=>({data:await business.updateTask((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.taskId,request.body)}));
    app.delete<{Params:{workspaceId:string;taskId:string}}>("/api/workspaces/:workspaceId/tasks/:taskId",async request=>({data:await business.deleteTask((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.params.taskId)}));
    app.get<{Params:{workspaceId:string};Querystring:{userId?:string}}>("/api/workspaces/:workspaceId/activities",async request=>({data:await business.activities((await actor(request.cookies[SESSION_COOKIE])).id,request.params.workspaceId,request.query.userId)}));
  }
  app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:{code:"NOT_FOUND",message:"Recurso não encontrado."}}));
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof AuthError||error instanceof WorkspaceError)return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
    if(error instanceof ZodError)return reply.code(400).send({error:{code:"VALIDATION_ERROR",message:"Dados inválidos.",details:error.issues}});
    app.log.error(error);
    return reply.code(500).send({error:{code:"INTERNAL_ERROR",message:"Não foi possível concluir a operação."}});
  });
  return app;
}

function handleAuthError(error:unknown,reply:{code:(status:number)=>{send:(body:unknown)=>unknown}}) {
  if(error instanceof AuthError)return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
  if(error instanceof ZodError)return reply.code(400).send({error:{code:"VALIDATION_ERROR",message:"Dados inválidos.",details:error.issues.map(issue=>({path:issue.path,code:issue.code}))}});
  return reply.code(500).send({error:{code:"INTERNAL_ERROR",message:"Não foi possível concluir a operação."}});
}
