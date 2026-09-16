import type { AuthUser } from "./stores/auth.js";

export function canNavigateRoute(input:{public?:boolean;admin?:boolean},user:AuthUser|null){
  if(!input.public&&!user)return "/login";
  if(input.public&&user)return "/dashboard";
  if(input.admin&&!['OWNER','ADMIN'].includes(user?.role||''))return "/dashboard";
  return undefined;
}
