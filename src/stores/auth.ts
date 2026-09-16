import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiRequest, ApiError } from "../services/api.js";

export type AuthState="idle"|"loading"|"authenticated"|"unauthenticated"|"error";
export interface AuthUser { id:string;email:string;name:string;job:string|null;avatarKey:string|null;workspaceId:string;workspaceName:string;role:"OWNER"|"ADMIN"|"MEMBER" }
const apiMessage=(value:unknown,fallback:string)=>value instanceof ApiError?value.message:fallback;

export const useAuthStore=defineStore("auth",()=>{
  const state=ref<AuthState>("idle"),user=ref<AuthUser|null>(null),error=ref("");
  const isAuthenticated=computed(()=>state.value==="authenticated"&&!!user.value);
  async function bootstrap(){
    if(state.value==="loading")return;state.value="loading";error.value="";
    try{const result=await apiRequest<{user:AuthUser}>("/auth/me");user.value=result.user;state.value="authenticated"}
    catch(e){user.value=null;state.value=e instanceof ApiError&&e.status===0?"error":"unauthenticated";error.value=apiMessage(e,"Não foi possível recuperar a sessão.")}
  }
  async function login(email:string,password:string){
    state.value="loading";error.value="";
    try{const result=await apiRequest<{user:AuthUser}>("/auth/login",{method:"POST",body:JSON.stringify({email,password})});user.value=result.user;state.value="authenticated";return result.user}
    catch(e){state.value="error";error.value=apiMessage(e,"Não foi possível entrar.");throw e}
  }
  async function register(input:{name:string;email:string;job:string;password:string}){
    state.value="loading";error.value="";
    try{const result=await apiRequest<{user:AuthUser}>("/auth/register",{method:"POST",body:JSON.stringify(input)});user.value=result.user;state.value="authenticated";return result.user}
    catch(e){state.value="error";error.value=apiMessage(e,"Não foi possível criar a conta.");throw e}
  }
  async function logout(){try{await apiRequest<{loggedOut:boolean}>("/auth/logout",{method:"POST"})}finally{user.value=null;state.value="unauthenticated";error.value=""}}
  async function updateProfile(name:string,job:string,avatarKey?:string){const result=await apiRequest<{user:AuthUser}>("/auth/me",{method:"PATCH",body:JSON.stringify({name,job,avatarKey:avatarKey||null})});user.value=result.user;return result.user}
  return {state,user,error,isAuthenticated,bootstrap,login,register,logout,updateProfile};
});
