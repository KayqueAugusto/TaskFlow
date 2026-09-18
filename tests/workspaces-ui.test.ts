import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const first={id:"11111111-1111-4111-8111-111111111111",name:"Principal",ownerId:"u1",role:"OWNER" as const,status:"ACTIVE" as const,createdAt:"2026-09-18"};
const second={...first,id:"22222222-2222-4222-8222-222222222222",name:"Equipe"};
const response=(data:unknown,status=200)=>({ok:status<400,status,json:async()=>status<400?{data}:{error:{code:"WORKSPACE_BLOCKED",message:"Acesso bloqueado"}}}) as Response;

beforeEach(()=>{
  vi.resetModules();
  const values=new Map<string,string>();
  vi.stubGlobal("window",{setTimeout,clearTimeout,localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
  vi.stubGlobal("fetch",vi.fn());
  setActivePinia(createPinia());
});

describe("troca de workspace",()=>{
  it("valida o workspace e membros pela API antes de trocar a preferência",async()=>{
    const {useWorkspacesStore}=await import("../src/stores/workspaces.js");
    const store=useWorkspacesStore();
    vi.mocked(fetch).mockResolvedValueOnce(response([first,second])).mockResolvedValueOnce(response([]));
    await store.load();
    expect(store.activeId).toBe(first.id);
    vi.mocked(fetch).mockResolvedValueOnce(response(second)).mockResolvedValueOnce(response([{id:"m2"}]));
    await store.select(second.id);
    expect(store.activeId).toBe(second.id);
    expect(store.members[0]?.id).toBe("m2");
    expect(window.localStorage.getItem("taskflow_active_workspace_id")).toBe(second.id);
    vi.mocked(fetch).mockResolvedValueOnce(response(null,403));
    await expect(store.select(first.id)).rejects.toThrow("Acesso bloqueado");
    expect(store.activeId).toBe(second.id);
    expect(window.localStorage.getItem("taskflow_active_workspace_id")).toBe(second.id);
  });

  it("descarta preferência removida ou bloqueada no próximo bootstrap",async()=>{
    const {useWorkspacesStore}=await import("../src/stores/workspaces.js");
    const store=useWorkspacesStore();
    window.localStorage.setItem("taskflow_active_workspace_id",second.id);
    vi.mocked(fetch).mockResolvedValueOnce(response([first])).mockResolvedValueOnce(response([]));
    await store.load();
    expect(store.activeId).toBe(first.id);
    expect(window.localStorage.getItem("taskflow_active_workspace_id")).toBe(first.id);
  });

  it("aceita convite sem cabeçalho JSON quando POST não possui corpo",async()=>{
    const {useWorkspacesStore}=await import("../src/stores/workspaces.js");
    const store=useWorkspacesStore();
    vi.mocked(fetch).mockResolvedValueOnce(response({workspaceId:first.id,role:"MEMBER"})).mockResolvedValueOnce(response([first])).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response([]));
    await store.accept("token-valido");
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("POST");
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).not.toHaveProperty("Content-Type");
    expect(store.activeId).toBe(first.id);
  });
});
