import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const project={id:"11111111-1111-4111-8111-111111111111",name:"Projeto real",description:"API",color:"#6c5ce7",status:"ACTIVE",start:"2026-09-01",due:"2026-10-30",memberIds:["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],createdAt:"2026-09-01",updatedAt:"2026-09-01"};
const task=(id:string,status:string,priority:string,due:string)=>({id,projectId:project.id,createdById:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",title:`Tarefa ${id}`,description:"",status,priority,due,completedAt:status==="COMPLETED"?"2026-09-25":null,createdAt:"2026-09-01",updatedAt:"2026-09-25",assignees:[{userId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",email:"user@example.test"}]});
const response=(data:unknown)=>({ok:true,status:200,json:async()=>({data})}) as Response;

beforeEach(()=>{vi.resetModules();setActivePinia(createPinia());vi.stubGlobal("window",{setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem:()=>undefined,removeItem:()=>undefined}});vi.stubGlobal("fetch",vi.fn())});

describe("dados reais de negócio",()=>{
  it("deriva dashboard, progresso, calendário e relatórios da mesma resposta da API",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(response([project])).mockResolvedValueOnce(response([task("1","COMPLETED","HIGH","2026-09-25"),task("2","PENDING","LOW","2026-09-26")])).mockResolvedValueOnce(response([]));
    const {useBusinessStore}=await import("../src/stores/business.js"),store=useBusinessStore();await store.load("workspace-a");
    expect(store.dashboard).toEqual({all:2,pending:1,active:0,done:1});expect(store.projectProgress(store.projects[0].id)).toBe(50);expect(store.tasksOn("2026-09-25")).toHaveLength(1);expect(store.reports).toMatchObject({priority:{high:1,low:1},completion:50});
  });

  it("descarta respostas atrasadas ao trocar de workspace",async()=>{
    let release:(value:Response)=>void=()=>undefined;const delayed=new Promise<Response>(resolve=>release=resolve);
    vi.mocked(fetch).mockImplementationOnce(()=>delayed).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([{...project,id:"22222222-2222-4222-8222-222222222222",name:"Workspace B"}])).mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([]));
    const {useBusinessStore}=await import("../src/stores/business.js"),store=useBusinessStore(),first=store.load("workspace-a"),second=store.load("workspace-b");release(response([project]));await Promise.all([first,second]);
    expect(store.workspaceId).toBe("workspace-b");expect(store.projects[0]?.name).toBe("Workspace B");
  });
});
