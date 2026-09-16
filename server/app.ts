import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { Environment } from "./config.js";
import { AuthError, AuthService, InMemoryAuthRepository, SESSION_COOKIE } from "./auth.js";

export function buildApp(environment:Environment,authService=new AuthService(new InMemoryAuthRepository())) {
  const app=Fastify({logger:environment.NODE_ENV!=="test"});
  app.register(cors,{origin:environment.WEB_ORIGIN,credentials:true});
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
  app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:{code:"NOT_FOUND",message:"Recurso não encontrado."}}));
  app.setErrorHandler((error,_request,reply)=>{
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
