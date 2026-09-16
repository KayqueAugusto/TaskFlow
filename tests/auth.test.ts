import { describe, expect, it } from "vitest";
import { AuthService, InMemoryAuthRepository } from "../server/auth.js";

describe("autenticação",()=>{
  const service=()=>new AuthService(new InMemoryAuthRepository());
  it("cadastra usuário, inicia sessão e nunca expõe hash",async()=>{
    const result=await service().register({name:"Pessoa Teste",email:"TESTE@EXEMPLO.COM",job:"QA",password:"senha-segura"});
    expect(result.user.email).toBe("teste@exemplo.com");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.token).toBeTruthy();
  });
  it("impede e-mail duplicado e login inválido",async()=>{
    const auth=service();await auth.register({name:"Pessoa Teste",email:"teste@example.com",job:"QA",password:"senha-segura"});
    await expect(auth.register({name:"Outra Pessoa",email:"TESTE@example.com",job:"QA",password:"senha-segura"})).rejects.toMatchObject({code:"EMAIL_IN_USE",statusCode:409});
    await expect(auth.login({email:"teste@example.com",password:"errada"})).rejects.toMatchObject({code:"INVALID_CREDENTIALS",statusCode:401});
  });
  it("recupera sessão e revoga no logout",async()=>{
    const auth=service(),login=await auth.register({name:"Pessoa Teste",email:"teste@example.com",job:"QA",password:"senha-segura"});
    expect((await auth.me(login.token)).user.email).toBe("teste@example.com");
    await auth.logout(login.token);await expect(auth.me(login.token)).rejects.toMatchObject({statusCode:401});
  });
  it("recusa sessão expirada",async()=>{
    let now=new Date("2026-01-01T00:00:00Z");const auth=new AuthService(new InMemoryAuthRepository(),()=>now);
    const login=await auth.register({name:"Pessoa Teste",email:"teste@example.com",job:"QA",password:"senha-segura"});now=new Date("2026-01-08T00:00:01Z");
    await expect(auth.me(login.token)).rejects.toMatchObject({statusCode:401});
  });
});
