import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { Environment } from "./config.js";
import { AuthError, AuthService, SESSION_COOKIE } from "./auth.js";
import { WorkspaceError, WorkspaceService } from "./workspaces.js";
import { BusinessService } from "./business.js";

export function buildApp(environment:Environment,authService:AuthService,workspaces?:WorkspaceService,business?:BusinessService,checkDatabase?:()=>Promise<void>) {
  const production=environment.NODE_ENV==="production";
  if(production&&(!workspaces||!business||!checkDatabase))throw new Error("Serviços persistentes obrigatórios em produção.");
  const app=Fastify({bodyLimit:1_048_576,trustProxy:production?(_address,hop)=>hop===0:false,logger:environment.NODE_ENV!=="test"?{serializers:{req:req=>({method:req.method,url:req.url?.split("?")[0]?.replace(/\/invitations\/[^/]+\/accept/,"/invitations/[redacted]/accept").replace(/\/invite\/[^/]+/,"/invite/[redacted]")}),res:res=>({statusCode:res.statusCode})},redact:["req.headers.cookie","req.headers.authorization","res.headers.set-cookie"]}:false});
  app.register(helmet,{contentSecurityPolicy:production?{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","blob:"],fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"]}}:false});
  app.register(cors,{origin:environment.APP_ORIGIN,credentials:true,methods:["GET","HEAD","POST","PATCH","DELETE"]});
  app.register(cookie,{secret:environment.SESSION_SECRET});
  app.register(rateLimit,{max:100,timeWindow:"1 minute",allowList:request=>!request.url.startsWith("/api/")});
  // Register routes after plugins so rate-limit's onRoute hook sees every route.
  app.after(()=>{
  app.addHook("onRequest",async(request,reply)=>{
    if(request.url.startsWith("/api/"))reply.header("Cache-Control","no-store");
    if(!["GET","HEAD","OPTIONS"].includes(request.method)&&request.headers.origin&&request.headers.origin!==environment.APP_ORIGIN)return reply.code(403).send({error:{code:"ORIGIN_REJECTED",message:"Origem não permitida."}});
    const value=request.cookies[SESSION_COOKIE];
    if(value){const unsigned=request.unsignCookie(value);request.cookies[SESSION_COOKIE]=unsigned.valid?unsigned.value:undefined}
  });
  app.get("/api/health",{config:{rateLimit:false}},async(_request,reply)=>{
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      if(checkDatabase)await Promise.race([checkDatabase(),new Promise<never>((_resolve,reject)=>{timeout=setTimeout(()=>reject(new Error("timeout")),2000)})]);
      return {data:{status:"ok",service:"taskflow-api"}};
    } catch {return reply.code(503).send({error:{code:"NOT_READY",message:"Serviço temporariamente indisponível."}})}
    finally {if(timeout)clearTimeout(timeout)}
  });

  const cookieOptions={httpOnly:true,sameSite:"lax" as const,secure:environment.COOKIE_SECURE,path:"/"};
  const setSession=(reply:FastifyReply,session:{token:string;expiresAt:Date})=>reply.setCookie(SESSION_COOKIE,session.token,{...cookieOptions,signed:true,expires:session.expiresAt});
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
    return reply.clearCookie(SESSION_COOKIE,cookieOptions).send({data:{loggedOut:true}});
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
  if(production){
    app.register(fastifyStatic,{root:fileURLToPath(new URL("../dist",import.meta.url)),index:false,dotfiles:"ignore",cacheControl:true,maxAge:0});
    app.get("/",(_request,reply)=>reply.header("Cache-Control","no-cache").type("text/html").sendFile("index.html"));
  }
  app.setNotFoundHandler((request,reply)=>{
    const path=request.url.split("?")[0];
    const frontend=/^\/(?:login|cadastro|dashboard|tarefas|projetos(?:\/[^/.]+)?|calendario|equipe(?:\/[^/.]+\/atividades)?|relatorios|configuracoes|invite\/[^/.]+)?\/?$/.test(path);
    if(production&&frontend&&["GET","HEAD"].includes(request.method))return reply.header("Cache-Control","no-cache").type("text/html").sendFile("index.html");
    return reply.code(404).send({error:{code:"NOT_FOUND",message:"Recurso não encontrado."}});
  });
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof AuthError||error instanceof WorkspaceError)return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
    if(error instanceof ZodError)return reply.code(400).send({error:{code:"VALIDATION_ERROR",message:"Dados inválidos.",details:error.issues.map(issue=>({path:issue.path,code:issue.code}))}});
    const status=(error as {statusCode?:number}).statusCode;
    if(status&&status>=400&&status<500)return reply.code(status).send({error:{code:`HTTP_${status}`,message:"Requisição não permitida ou inválida."}});
    app.log.error({requestId:_request.id},"Falha interna ao processar requisição.");
    return reply.code(500).send({error:{code:"INTERNAL_ERROR",message:"Não foi possível concluir a operação."}});
  });
  });
  return app;
}

function handleAuthError(error:unknown,reply:{code:(status:number)=>{send:(body:unknown)=>unknown}}) {
  if(error instanceof AuthError)return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
  if(error instanceof ZodError)return reply.code(400).send({error:{code:"VALIDATION_ERROR",message:"Dados inválidos.",details:error.issues.map(issue=>({path:issue.path,code:issue.code}))}});
  return reply.code(500).send({error:{code:"INTERNAL_ERROR",message:"Não foi possível concluir a operação."}});
}
