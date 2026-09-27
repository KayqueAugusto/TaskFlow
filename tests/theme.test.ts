import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { createMemoryHistory, createRouter } from "vue-router";

beforeEach(()=>{
  vi.resetModules();
  setActivePinia(createPinia());
  const values=new Map<string,string>([
    ["taskflow_local_context",JSON.stringify({accountId:1,memberId:1,workspaceId:1,name:"Kayque Milhome",email:"kayque@taskflow.demo",role:"Administrador",initials:"KM"})],
    ["taskflow_prefs_1",JSON.stringify({notifications:true,compact:false,weekly:true,theme:"Escuro"})]
  ]);
  const classes=new Set<string>();
  vi.stubGlobal("window",{setTimeout,clearTimeout,localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
  vi.stubGlobal("document",{documentElement:{dataset:{} as Record<string,string>,classList:{toggle:(name:string,enabled:boolean)=>enabled?classes.add(name):classes.delete(name),remove:(name:string)=>classes.delete(name)}}});
  vi.stubGlobal("fetch",vi.fn());
});

describe("escopo do tema",()=>{
  it("remove o tema ao sair e mantém a preferência salva nas rotas públicas",async()=>{
    const {useTaskFlowStore}=await import("../src/stores/taskflow.js");
    const store=useTaskFlowStore();
    expect(document.documentElement.dataset.theme).toBe("escuro");
    store.logout();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem("taskflow_prefs_1")).toContain("Escuro");

    const [{default:LoginView},{default:RegisterView}]=await Promise.all([import("../src/views/LoginView.vue"),import("../src/views/RegisterView.vue")]);
    const router=createRouter({history:createMemoryHistory(),routes:[{path:"/login",component:LoginView},{path:"/register",component:RegisterView},{path:"/cadastro",component:RegisterView}]});
    await router.push("/login");
    expect(await renderToString(createSSRApp(LoginView).use(router))).not.toContain("data-theme");
    await router.push("/register");
    expect(await renderToString(createSSRApp(RegisterView).use(router))).not.toContain("data-theme");
  });

  it("restaura o tema salvo quando a área autenticada é aberta novamente",async()=>{
    const {useTaskFlowStore}=await import("../src/stores/taskflow.js");
    const store=useTaskFlowStore();
    store.logout();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    store.login("kayque@taskflow.demo","123456");
    expect(document.documentElement.dataset.theme).toBe("escuro");
  });
});
