import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore, type AuthUser } from "../src/stores/auth.js";
import { useTaskFlowStore } from "../src/stores/taskflow.js";
import { canNavigateRoute } from "../src/router-guards.js";

const user:AuthUser={id:"u-123",email:"other@example.com",name:"caio",job:"Designer",avatarKey:null,workspaceId:"w",workspaceName:"Workspace de caio",role:"OWNER"};
const response=(data:unknown,status=200)=>({ok:status<400,status,json:async()=>status<400?{data}:{error:{code:"UNAUTHENTICATED",message:"Sessão encerrada"}}});

beforeEach(()=>{
  setActivePinia(createPinia());
  vi.stubGlobal("window",{setTimeout,clearTimeout});
  vi.stubGlobal("document",{documentElement:{dataset:{},classList:{toggle:()=>undefined}}});
  vi.stubGlobal("fetch",vi.fn());
});

describe("identidade e logout",()=>{
  it("usa o nome cadastrado na identidade da sidebar e do Dashboard",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response({user},201) as Response);
    const auth=useAuthStore(),local=useTaskFlowStore();
    await auth.register({name:"caio",email:user.email,job:"Designer",password:"senha-segura"});
    local.adoptAuthenticatedUser(auth.user!);
    expect(auth.user?.name).toBe("caio");
    expect(local.session?.name).toBe("caio");
    expect(local.members.find(m=>m.id===local.session?.memberId)?.name).toBe("caio");
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toContain('"name":"caio"');
  });

  it("atualiza nome, cargo e membro a partir do PATCH e conserva o nome no bootstrap",async()=>{
    const changed={...user,name:"Caio Novo",job:"Product Designer"};
    vi.mocked(fetch).mockResolvedValueOnce(response({user}) as Response).mockResolvedValueOnce(response({user:changed}) as Response).mockResolvedValueOnce(response({user:changed}) as Response);
    const auth=useAuthStore(),local=useTaskFlowStore();
    await auth.bootstrap();local.adoptAuthenticatedUser(auth.user!);
    local.adoptAuthenticatedUser(await auth.updateProfile(changed.name,changed.job));
    expect(auth.user?.name).toBe("Caio Novo");
    expect(local.session?.name).toBe("Caio Novo");
    expect(local.accounts.find(a=>a.id===local.session?.accountId)?.name).toBe("Caio Novo");
    expect(local.members.find(m=>m.id===local.session?.memberId)?.job).toBe("Product Designer");
    await auth.bootstrap();local.adoptAuthenticatedUser(auth.user!);
    expect(local.session?.name).toBe("Caio Novo");
  });

  it("encerra a sessão mesmo quando a API diz que ela já terminou e bloqueia rota privada",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response({user}) as Response).mockResolvedValueOnce(response({},401) as Response);
    const auth=useAuthStore(),local=useTaskFlowStore();
    await auth.bootstrap();local.adoptAuthenticatedUser(auth.user!);
    await auth.logout();local.logout();
    expect(auth.user).toBeNull();
    expect(local.session).toBeNull();
    expect(canNavigateRoute({},auth.user)).toBe("/login");
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain("/auth/logout");
  });
});
