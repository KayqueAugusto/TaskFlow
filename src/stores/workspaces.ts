import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiRequest, ApiError } from "../services/api.js";
import { browserDataRepository, storageKeys } from "../services/storage.js";

export type WorkspaceRole="OWNER"|"ADMIN"|"MEMBER";
export type MembershipStatus="ACTIVE"|"BLOCKED";
export interface WorkspaceRecord {id:string;name:string;ownerId:string;role:WorkspaceRole;status:MembershipStatus;createdAt:string}
export interface MemberRecord {id:string;userId:string;workspaceId:string;email:string;name:string;job:string|null;workspaceJob:string|null;avatarKey:string|null;role:WorkspaceRole;status:MembershipStatus}
export interface InvitationRecord {id:string;email:string;role:"ADMIN"|"MEMBER";workspaceJob:string|null;status:"PENDING"|"ACCEPTED"|"REJECTED"|"REVOKED"|"EXPIRED";expiresAt:string;createdAt:string;link?:string}

export const useWorkspacesStore=defineStore("workspaces",()=>{
  const list=ref<WorkspaceRecord[]>([]),activeId=ref<string|null>(null),members=ref<MemberRecord[]>([]),invitations=ref<InvitationRecord[]>([]);
  const state=ref<"idle"|"loading"|"ready"|"error">("idle"),error=ref("");
  const active=computed(()=>list.value.find(workspace=>workspace.id===activeId.value)??null);
  const canManage=computed(()=>active.value?.role==="OWNER"||active.value?.role==="ADMIN");
  const failure=(value:unknown)=>value instanceof ApiError?value.message:"Não foi possível carregar o workspace.";
  const key=storageKeys.activeWorkspace;

  async function load(){
    state.value="loading";error.value="";
    try{
      list.value=await apiRequest<WorkspaceRecord[]>("/workspaces");
      const remembered=activeId.value??browserDataRepository.readText(key);
      activeId.value=list.value.some(workspace=>workspace.id===remembered)?remembered:list.value[0]?.id??null;
      if(activeId.value){browserDataRepository.writeText(key,activeId.value);await loadMembers()}
      else{browserDataRepository.remove(key);members.value=[];invitations.value=[]}
      state.value="ready";
    }catch(value){state.value="error";error.value=failure(value);throw value}
  }

  async function loadMembers(){
    if(!activeId.value){members.value=[];return}
    members.value=await apiRequest<MemberRecord[]>(`/workspaces/${activeId.value}/members`);
  }

  async function select(id:string){
    const workspace=await apiRequest<WorkspaceRecord>(`/workspaces/${id}`);
    if(workspace.status!=="ACTIVE")throw new Error("Workspace indisponível.");
    const selectedMembers=await apiRequest<MemberRecord[]>(`/workspaces/${id}/members`);
    activeId.value=id;members.value=selectedMembers;browserDataRepository.writeText(key,id);
    invitations.value=[];
    return workspace;
  }

  async function create(name:string){
    const workspace=await apiRequest<WorkspaceRecord>("/workspaces",{method:"POST",body:JSON.stringify({name})});
    list.value.push(workspace);await select(workspace.id);return workspace;
  }

  async function update(name:string){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    const workspace=await apiRequest<WorkspaceRecord>(`/workspaces/${activeId.value}`,{method:"PATCH",body:JSON.stringify({name})});
    list.value=list.value.map(item=>item.id===workspace.id?workspace:item);return workspace;
  }

  async function editMember(id:string,data:{workspaceJob?:string|null;role?:"ADMIN"|"MEMBER";status?:MembershipStatus}){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    const member=await apiRequest<MemberRecord>(`/workspaces/${activeId.value}/members/${id}`,{method:"PATCH",body:JSON.stringify(data)});
    members.value=members.value.map(item=>item.id===id?member:item);
    return member;
  }

  async function removeMember(id:string){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    await apiRequest(`/workspaces/${activeId.value}/members/${id}`,{method:"DELETE"});
    members.value=members.value.filter(item=>item.id!==id);
  }

  async function transfer(userId:string){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    const result=await apiRequest<{ownerId:string;previousOwnerId:string}>(`/workspaces/${activeId.value}/transfer-ownership`,{method:"POST",body:JSON.stringify({userId})});
    await load();return result;
  }

  async function loadInvitations(){
    if(!activeId.value){invitations.value=[];return}
    invitations.value=await apiRequest<InvitationRecord[]>(`/workspaces/${activeId.value}/invitations`);
  }

  async function createInvitation(input:{email:string;role:"ADMIN"|"MEMBER";workspaceJob?:string|null}){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    const invitation=await apiRequest<InvitationRecord>(`/workspaces/${activeId.value}/invitations`,{method:"POST",body:JSON.stringify(input)});
    invitations.value.unshift(invitation);return invitation;
  }

  async function revokeInvitation(id:string){
    if(!activeId.value)throw new Error("Selecione um workspace.");
    await apiRequest(`/workspaces/${activeId.value}/invitations/${id}`,{method:"DELETE"});
    invitations.value=invitations.value.map(item=>item.id===id?{...item,status:"REVOKED"}:item);
  }

  async function accept(token:string){
    const result=await apiRequest<{workspaceId:string;role:WorkspaceRole}>(`/invitations/${encodeURIComponent(token)}/accept`,{method:"POST"});
    await load();await select(result.workspaceId);return result;
  }

  function clear(){list.value=[];activeId.value=null;members.value=[];invitations.value=[];state.value="idle";error.value=""}
  return {list,activeId,active,members,invitations,state,error,canManage,load,loadMembers,select,create,update,editMember,removeMember,transfer,loadInvitations,createInvitation,revokeInvitation,accept,clear};
});
