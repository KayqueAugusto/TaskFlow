import { describe, expect, it } from "vitest";
import { readEnvironment } from "../server/config.js";
import { buildApp } from "../server/app.js";
import { AuthService } from "../server/auth.js";
import { InMemoryAuthRepository } from "./auth-repository.js";

const production={NODE_ENV:"production",PORT:"10000",APP_ORIGIN:"https://taskflow-example.onrender.com",DATABASE_URL:"postgresql://user:random-password@database.internal/taskflow",SESSION_SECRET:"aB3dE5fG7hI9jK1lM2nO4pQ6rS8tU0vW",COOKIE_SECURE:"true"};
const environment=()=>readEnvironment({NODE_ENV:"test",DATABASE_URL:"postgresql://test:test@localhost/test",COOKIE_SECURE:"true"});
describe("segurança de produção",()=>{
  it("valida configuração e recusa defaults locais, origens ambíguas e segredos fracos",()=>{
    expect(readEnvironment(production).PORT).toBe(10000);
    for(const change of [{PORT:undefined},{DATABASE_URL:undefined},{SESSION_SECRET:undefined},{SESSION_SECRET:"a".repeat(64)},{APP_ORIGIN:"https://example.com/path"},{APP_ORIGIN:"https://example.com/"},{APP_ORIGIN:"*"},{APP_ORIGIN:"http://localhost:3001"},{COOKIE_SECURE:"false"},{DATABASE_URL:"postgresql://user:pass@localhost/db"}])expect(()=>readEnvironment({...production,...change})).toThrow();
    expect(()=>readEnvironment({...production,DATABASE_URL:"sensitive-invalid-value"})).toThrow("DATABASE_URL");
    expect(()=>readEnvironment({...production,DATABASE_URL:"sensitive-invalid-value"})).not.toThrow("sensitive-invalid-value");
  });
  it("protege cookie, recusa assinatura adulterada e origem externa",async()=>{
    const app=buildApp(environment(),new AuthService(new InMemoryAuthRepository()));
    try {
      const result=await app.inject({method:"POST",url:"/api/auth/register",payload:{name:"Secure User",email:"secure@example.test",job:"QA",password:"test-password"}});
      const cookie=String(result.headers["set-cookie"]);
      expect(cookie).toContain("HttpOnly");expect(cookie).toContain("Secure");expect(cookie).toContain("SameSite=Lax");expect(cookie).not.toContain("Domain=");
      expect((await app.inject({url:"/api/auth/me",headers:{cookie:cookie.split(";")[0]+"tampered"}})).statusCode).toBe(401);
      expect((await app.inject({method:"POST",url:"/api/auth/logout",headers:{origin:"https://attacker.example"}})).statusCode).toBe(403);
      const cors=await app.inject({method:"OPTIONS",url:"/api/auth/me",headers:{origin:"https://attacker.example","access-control-request-method":"PATCH"}});
      expect(cors.headers["access-control-allow-origin"]).not.toBe("https://attacker.example");
    } finally {await app.close()}
  });
  it("readiness falha sem expor conexão e preserva erros 400, 413 e 429",async()=>{
    const app=buildApp(environment(),new AuthService(new InMemoryAuthRepository()),undefined,undefined,async()=>{throw new Error("postgresql://secret")});
    try {
      const health=await app.inject({url:"/api/health"});expect(health.statusCode).toBe(503);expect(health.body).not.toContain("postgresql");
      expect(health.headers["x-content-type-options"]).toBe("nosniff");
      expect((await app.inject({method:"POST",url:"/api/auth/login",headers:{"content-type":"application/json"},payload:"{"})).statusCode).toBe(400);
      expect((await app.inject({method:"POST",url:"/api/auth/login",payload:{padding:"x".repeat(1_048_577)}})).statusCode).toBe(413);
      let status=0;for(let i=0;i<11;i++)status=(await app.inject({method:"POST",url:"/api/auth/login",payload:{}})).statusCode;
      expect(status).toBe(429);
    } finally {await app.close()}
  });
});
