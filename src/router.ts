import { createRouter, createWebHistory } from "vue-router";
import LoginView from "./views/LoginView.vue";
import RegisterView from "./views/RegisterView.vue";
import WorkspaceView from "./views/WorkspaceView.vue";
import { useAuthStore } from "./stores/auth";
import { canNavigateRoute } from "./router-guards";

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
  const auth=useAuthStore();
  if(auth.state==="idle")await auth.bootstrap();
  return canNavigateRoute(to.meta,auth.isAuthenticated?auth.user:null);
});

export default router;
