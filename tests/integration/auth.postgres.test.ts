import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../../server/app.js";
import { AuthService, PrismaAuthRepository } from "../../server/auth.js";

const testUrl=process.env.DATABASE_URL_TEST;
const enabled=Boolean(testUrl&&testUrl.toLowerCase().includes("test"));
const describePostgres=describe.skipIf(!enabled);

describePostgres("autenticação com PostgreSQL real",()=>{
  const prisma=enabled&&testUrl?new PrismaClient({datasources:{db:{url:testUrl}}}):null;
  const environment={NODE_ENV:"test" as const,API_HOST:"127.0.0.1",API_PORT:3002,WEB_ORIGIN:"http://localhost:5173"};
  let app:ReturnType<typeof buildApp>;
  beforeAll(async()=>{
    if(!testUrl||!testUrl.toLowerCase().includes("test"))throw new Error("DATABASE_URL_TEST deve apontar para banco exclusivo de testes.");
    await prisma!.$executeRawUnsafe('TRUNCATE TABLE "Session", "Notification", "UserPreference", "Activity", "Comment", "TaskAssignee", "Task", "Project", "Invitation", "Membership", "Workspace", "Profile", "Credential", "User" CASCADE');
    app=buildApp(environment,new AuthService(new PrismaAuthRepository(prisma!)));
  });
  afterAll(async()=>{await app?.close();await prisma?.$disconnect()});
  it("persiste cadastro, perfil, workspace, membership, sessão, login e revogação",async()=>{
    const register=await app.inject({method:"POST",url:"/api/auth/register",payload:{name:"Integração PostgreSQL",email:"pg@example.com",job:"QA",password:"senha-segura"}});
    expect(register.statusCode).toBe(201);expect(register.json().data.user).not.toHaveProperty("passwordHash");
    const setCookie=register.headers["set-cookie"],cookie=(Array.isArray(setCookie)?setCookie[0]:setCookie)?.split(";")[0];expect(cookie).toBeTruthy();
    const user=await prisma!.user.findUnique({where:{email:"pg@example.com"},include:{credential:true,profile:true,memberships:true,sessions:true}});
    expect(user?.credential?.passwordHash).toBeTruthy();expect(user?.profile?.name).toBe("Integração PostgreSQL");expect(user?.memberships[0]?.role).toBe("OWNER");expect(user?.sessions).toHaveLength(1);
    const me=await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}});expect(me.statusCode).toBe(200);
    const login=await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"PG@EXAMPLE.COM",password:"senha-segura"}});expect(login.statusCode).toBe(200);
    const logout=await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie}});expect(logout.statusCode).toBe(200);
    expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}})).statusCode).toBe(401);
    expect((await app.inject({method:"POST",url:"/api/auth/login",payload:{email:"pg@example.com",password:"errada"}})).statusCode).toBe(401);
  });
});
