import { createRouter, createWebHistory } from "vue-router";
import LoginView from "./views/LoginView.vue";
import RegisterView from "./views/RegisterView.vue";
import WorkspaceView from "./views/WorkspaceView.vue";
import { apiRequest } from "./services/api";
import type { AuthUser } from "./stores/auth";
import { canNavigateRoute } from "./router-guards";

let sessionChecked=false;
let authenticatedUser:AuthUser|null=null;
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login", component: LoginView, meta: { public: true } },
    { path: "/cadastro", component: RegisterView, meta: { public: true } },
    { path: "/dashboard", component: WorkspaceView },
    { path: "/tarefas", component: WorkspaceView },
    { path: "/projetos", component: WorkspaceView },
    { path: "/projetos/:id", component: WorkspaceView },
    { path: "/calendario", component: WorkspaceView },
    { path: "/equipe", component: WorkspaceView, meta: { admin: true } },
    { path: "/equipe/:id/atividades", component: WorkspaceView, meta: { admin: true } },
    { path: "/relatorios", component: WorkspaceView, meta: { admin: true } },
    { path: "/configuracoes", component: WorkspaceView },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" }
  ]
});

router.beforeEach(async (to) => {
  if(!sessionChecked||to.meta.public){
    try { authenticatedUser=(await apiRequest<{user:AuthUser}>("/auth/me")).user; }
    catch { authenticatedUser=null; }
    sessionChecked=true;
  }
  return canNavigateRoute(to.meta,authenticatedUser);
});

export function setAuthenticatedRouteUser(user:AuthUser|null){authenticatedUser=user;sessionChecked=true}

export default router;
