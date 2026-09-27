import { InMemoryAuthRepository } from "./auth-repository.js";
import { describe, expect, it } from "vitest";
import { buildApp } from "../server/app.js";
import { readEnvironment } from "../server/config.js";
import { AuthService } from "../server/auth.js";

const environment=readEnvironment({NODE_ENV:"test",DATABASE_URL:"postgresql://test:test@localhost/test"});
describe("API",()=>{
  it("expõe saúde com envelope padronizado",async()=>{
    const app=buildApp(environment,new AuthService(new InMemoryAuthRepository())),response=await app.inject({method:"GET",url:"/api/health"});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({data:{status:"ok",service:"taskflow-api"}});
    await app.close();
  },15000);
  it("retorna erro padronizado para rota inexistente",async()=>{
    const app=buildApp(environment,new AuthService(new InMemoryAuthRepository())),response=await app.inject({method:"GET",url:"/api/inexistente"});
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
  it("permite PATCH do perfil a partir do frontend",async()=>{
    const app=buildApp(environment,new AuthService(new InMemoryAuthRepository()));
    const response=await app.inject({method:"OPTIONS",url:"/api/auth/me",headers:{origin:environment.APP_ORIGIN,"access-control-request-method":"PATCH","access-control-request-headers":"content-type"}});
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    await app.close();
  });
  it("executa cadastro, recuperação, logout e revogação por cookie",async()=>{
    const app=buildApp(environment,new AuthService(new InMemoryAuthRepository()));
    const register=await app.inject({method:"POST",url:"/api/auth/register",payload:{name:"API Teste",email:"api@example.com",job:"QA",password:"senha-segura"}});
    expect(register.statusCode).toBe(201);expect(register.json().data.user).not.toHaveProperty("passwordHash");
    const setCookie=register.headers["set-cookie"],cookie=(Array.isArray(setCookie)?setCookie[0]:setCookie)?.split(";")[0];expect(cookie).toMatch(/^taskflow_session=/);
    const me=await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}});expect(me.statusCode).toBe(200);expect(me.json().data.user.email).toBe("api@example.com");
    const logout=await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie}});expect(logout.statusCode).toBe(200);
    const revoked=await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}});expect(revoked.statusCode).toBe(401);
    const anonymous=await app.inject({method:"GET",url:"/api/auth/me"});expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});
