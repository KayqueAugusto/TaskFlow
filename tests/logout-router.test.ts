import { beforeEach, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

vi.mock("vue-router",async importOriginal=>{
  const router=await importOriginal<typeof import("vue-router")>();
  return {...router,createWebHistory:router.createMemoryHistory};
});

beforeEach(()=>{
  setActivePinia(createPinia());
  const values=new Map<string,string>();
  vi.stubGlobal("window",{setTimeout,clearTimeout,localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}});
  vi.stubGlobal("fetch",vi.fn());
});

it("redireciona ao login e bloqueia Dashboard após logout",async()=>{
  const {default:router}=await import("../src/router.js");
  const {useAuthStore}=await import("../src/stores/auth.js");
  const user={id:"u",email:"caio@example.com",name:"caio",job:"Designer",avatarKey:null,workspaceId:"w",workspaceName:"Workspace de caio",role:"OWNER"};
  vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({data:{user}})} as Response)
    .mockResolvedValueOnce({ok:true,json:async()=>({data:{loggedOut:true}})} as Response);
  await router.push("/dashboard");
  expect(router.currentRoute.value.path).toBe("/dashboard");
  vi.stubGlobal("document",{documentElement:{dataset:{},classList:{toggle:()=>undefined}}});
  const {default:WorkspaceView}=await import("../src/views/WorkspaceView.vue");
  const html=await renderToString(createSSRApp(WorkspaceView).use(router));
  expect(html).toContain("Olá, caio");
  expect(html).toContain("<strong>caio</strong><small>Designer</small>");
  await useAuthStore().logout();
  await router.replace("/login");
  expect(router.currentRoute.value.path).toBe("/login");
  await router.push("/dashboard");
  expect(router.currentRoute.value.path).toBe("/login");
});
