import { createRouter, createWebHistory } from "vue-router";
import LoginView from "./views/LoginView.vue";
import RegisterView from "./views/RegisterView.vue";
import WorkspaceView from "./views/WorkspaceView.vue";
import { useAuthStore } from "./stores/auth";
import { useWorkspacesStore } from "./stores/workspaces";
import { canNavigateRoute } from "./router-guards";
import InvitationView from "./views/InvitationView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login", component: LoginView, meta: { public: true } },
    { path: "/cadastro", component: RegisterView, meta: { public: true } },
    { path: "/invite/:token", component: InvitationView },
    { path: "/dashboard", component: WorkspaceView },
    { path: "/tarefas", component: WorkspaceView },
    { path: "/projetos", component: WorkspaceView },
    { path: "/projetos/:id", component: WorkspaceView },
    { path: "/calendario", component: WorkspaceView },
    { path: "/equipe", component: WorkspaceView },
    { path: "/equipe/:id/atividades", component: WorkspaceView },
    { path: "/relatorios", component: WorkspaceView, meta: { admin: true } },
    { path: "/configuracoes", component: WorkspaceView },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" }
  ]
});

router.beforeEach(async (to) => {
  const auth=useAuthStore();
  if(auth.state==="idle")await auth.bootstrap();
  const decision=canNavigateRoute({...to.meta,admin:false},auth.isAuthenticated?auth.user:null);
  if(decision==="/login"&&to.path.startsWith("/invite/"))return {path:"/login",query:{redirect:to.fullPath}};
  if(decision)return decision;
  if(!to.meta.public){
    const workspaces=useWorkspacesStore();
    try{await workspaces.load()}catch{/* A tela mostra o erro de carregamento. */}
    if(to.meta.admin&&!workspaces.canManage)return "/dashboard";
  }
  return undefined;
});

export default router;
