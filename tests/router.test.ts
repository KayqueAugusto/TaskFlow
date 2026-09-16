import { describe, expect, it } from "vitest";
import { canNavigateRoute } from "../src/router-guards.js";

const user={id:"u",email:"u@example.com",name:"U",job:null,avatarKey:null,workspaceId:"w",workspaceName:"W",role:"MEMBER" as const};
describe("guards de rota",()=>{
  it("exige sessão em rotas privadas",()=>expect(canNavigateRoute({},null)).toBe("/login"));
  it("impede usuário autenticado de voltar ao login",()=>expect(canNavigateRoute({public:true},user)).toBe("/dashboard"));
  it("restringe páginas administrativas",()=>expect(canNavigateRoute({admin:true},user)).toBe("/dashboard"));
});
