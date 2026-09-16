import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { Account, Invite, Member, Membership, Prefs, Project, Role, Session, Task, Workspace } from "../domain/models";
import { seedAccounts, seedMembers, seedMemberships, seedProjects, seedTasks, seedWorkspaces } from "../domain/seeds";
import { browserDataRepository as repository, storageKeys } from "../services/storage";
import { apiRequest } from "../services/api";

export type { Account, Invite, Member, Membership, Prefs, Priority, Project, Role, Session, Status, Task, Workspace } from "../domain/models";

const read=<T>(key:string,fallback:T):T=>repository.read(key,fallback);
const initials=(name:string)=>name.split(" ").filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase();

export const useTaskFlowStore=defineStore("taskflow",()=>{
  const session=ref<Session|null>(read(storageKeys.localContext,null));
  const accounts=ref<Account[]>(read("taskflow_accounts",seedAccounts));
  const workspaces=ref<Workspace[]>(read("taskflow_workspaces",seedWorkspaces));
  const memberships=ref<Membership[]>(read("taskflow_memberships",seedMemberships));
  const invites=ref<Invite[]>(read("taskflow_invites",[]));
  const workspaceId=computed(()=>session.value?.workspaceId||1);
  const tasks=ref<Task[]>(read(`taskflow_tasks_${workspaceId.value}`,workspaceId.value===1?seedTasks:[]));
  const projects=ref<Project[]>(read(`taskflow_projects_${workspaceId.value}`,workspaceId.value===1?seedProjects:[]));
  const members=ref<Member[]>(read(`taskflow_members_${workspaceId.value}`,workspaceId.value===1?seedMembers:[]));
  const prefs=ref<Prefs>(read(`taskflow_prefs_${session.value?.accountId||0}`,{notifications:true,compact:false,weekly:true,theme:"Claro"}));
  const admin=computed(()=>session.value?.role==="Administrador");
  const visibleTasks=computed(()=>admin.value?tasks.value:tasks.value.filter(t=>t.assigneeId===session.value?.memberId));
  const visibleProjects=computed(()=>admin.value?projects.value:projects.value.filter(p=>p.members.includes(session.value?.memberId||0)));
  const currentWorkspace=computed(()=>workspaces.value.find(w=>w.id===workspaceId.value));

  const persist=()=>{
    if(session.value)repository.write(storageKeys.localContext,session.value);
    repository.write(storageKeys.accounts,accounts.value);
    repository.write(storageKeys.workspaces,workspaces.value);
    repository.write(storageKeys.memberships,memberships.value);
    repository.write(storageKeys.invites,invites.value);
    repository.write(storageKeys.tasks(workspaceId.value),tasks.value);
    repository.write(storageKeys.projects(workspaceId.value),projects.value);
    repository.write(storageKeys.members(workspaceId.value),members.value);
    if(session.value)repository.write(storageKeys.prefs(session.value.accountId),prefs.value);
  };
  watch([tasks,projects,members,accounts,workspaces,memberships,invites,prefs],persist,{deep:true});
  watch(prefs,p=>{document.documentElement.dataset.theme=p.theme.toLowerCase();document.documentElement.classList.toggle("compact-mode",p.compact)},{deep:true,immediate:true});

  function login(email:string,password:string){
    const account=accounts.value.find(a=>a.email.toLowerCase()===email.toLowerCase()&&a.password===password);
    if(!account)throw new Error("E-mail ou senha inválidos.");
    const membership=memberships.value.find(m=>m.accountId===account.id);
    if(!membership)throw new Error("Conta sem workspace disponível.");
    const stored=read<Member[]>(`taskflow_members_${membership.workspaceId}`,membership.workspaceId===1?seedMembers:[]);
    if(stored.find(m=>m.id===account.id)?.blocked)throw new Error("Seu acesso está bloqueado.");
    session.value={accountId:account.id,memberId:account.id,workspaceId:membership.workspaceId,name:account.name,email:account.email,role:membership.role,initials:account.initials};persist();
  }
  function demo(role:Role){const account=accounts.value.find(a=>a.id===(role==="Administrador"?1:2))!;login(account.email,"123456")}
  function logout(){void apiRequest("/auth/logout",{method:"POST"}).catch(()=>undefined);session.value=null;repository.remove(storageKeys.localContext)}

  function adoptAuthenticatedUser(user:{id:string;email:string;name:string;job:string|null;avatarKey:string|null;workspaceId:string;workspaceName:string;role:"OWNER"|"ADMIN"|"MEMBER"}){
    const known=user.email.toLowerCase()==="kayque@taskflow.demo"?1:user.email.toLowerCase()==="marina@taskflow.demo"?2:Math.abs([...user.id].reduce((hash,char)=>(hash*31+char.charCodeAt(0))|0,7))||3;
    const localWorkspace=known<=2?1:known+100000;
    const role=user.role==="OWNER"||user.role==="ADMIN"?"Administrador":"Membro" as Role;
    if(!accounts.value.some(account=>account.id===known))accounts.value.push({id:known,name:user.name,email:user.email,password:"",job:user.job||"Profissional",initials:initials(user.name),avatar:user.avatarKey||undefined});
    if(!workspaces.value.some(workspace=>workspace.id===localWorkspace))workspaces.value.push({id:localWorkspace,name:user.workspaceName,ownerId:known});
    if(!memberships.value.some(membership=>membership.accountId===known&&membership.workspaceId===localWorkspace))memberships.value.push({accountId:known,workspaceId:localWorkspace,role});
    session.value={accountId:known,memberId:known,workspaceId:localWorkspace,name:user.name,email:user.email,role,initials:initials(user.name)};
    loadWorkspace(localWorkspace);persist();
  }
  function register(data:{name:string;email:string;job:string;password:string}){
    if(accounts.value.some(a=>a.email.toLowerCase()===data.email.toLowerCase()))throw new Error("Este e-mail já está cadastrado.");
    const id=Date.now(),wid=id+1,account:Account={id,...data,initials:initials(data.name)},workspace:Workspace={id:wid,name:`Workspace de ${data.name.split(" ")[0]}`,ownerId:id};
    accounts.value.push(account);workspaces.value.push(workspace);memberships.value.push({accountId:id,workspaceId:wid,role:"Administrador"});
    repository.write(storageKeys.members(wid),[{id,name:data.name,email:data.email,job:data.job,role:"Administrador",initials:account.initials,color:"purple"}]);
    repository.write(storageKeys.tasks(wid),[]);repository.write(storageKeys.projects(wid),[]);
    session.value={accountId:id,memberId:id,workspaceId:wid,name:data.name,email:data.email,role:"Administrador",initials:account.initials};loadWorkspace(wid);persist();
  }
  function loadWorkspace(id:number){tasks.value=read(`taskflow_tasks_${id}`,id===1?seedTasks:[]);projects.value=read(`taskflow_projects_${id}`,id===1?seedProjects:[]);members.value=read(`taskflow_members_${id}`,id===1?seedMembers:[])}
  function switchWorkspace(id:number){if(!session.value)return;persist();const membership=memberships.value.find(m=>m.accountId===session.value!.accountId&&m.workspaceId===id);if(!membership)return;loadWorkspace(id);session.value={...session.value,workspaceId:id,role:membership.role};prefs.value=read(`taskflow_prefs_${session.value.accountId}`,prefs.value);persist()}
  function createWorkspace(name:string){if(!session.value)return;const id=Date.now();workspaces.value.push({id,name,ownerId:session.value.accountId});memberships.value.push({accountId:session.value.accountId,workspaceId:id,role:"Administrador"});repository.write(storageKeys.members(id),[{id:session.value.accountId,name:session.value.name,email:session.value.email,job:accounts.value.find(a=>a.id===session.value!.accountId)?.job||"Profissional",role:"Administrador",initials:session.value.initials,color:"purple"}]);repository.write(storageKeys.tasks(id),[]);repository.write(storageKeys.projects(id),[]);switchWorkspace(id)}
  function saveTask(task:Task){const index=tasks.value.findIndex(t=>t.id===task.id);if(index>=0)tasks.value[index]=task;else tasks.value.unshift(task)}
  function removeTask(id:number){tasks.value=tasks.value.filter(t=>t.id!==id)}
  function saveProject(project:Project){const index=projects.value.findIndex(p=>p.id===project.id);if(index>=0)projects.value[index]=project;else projects.value.unshift(project)}
  function saveMember(member:Member){const index=members.value.findIndex(m=>m.id===member.id);if(index>=0)members.value[index]=member;else members.value.push(member)}
  function removeMember(id:number){if(!session.value)return;members.value=members.value.filter(m=>m.id!==id);memberships.value=memberships.value.filter(m=>!(m.accountId===id&&m.workspaceId===workspaceId.value));tasks.value=tasks.value.map(t=>t.assigneeId===id?{...t,assigneeId:session.value!.memberId}:t);projects.value=projects.value.map(p=>({...p,members:p.members.filter(mid=>mid!==id)}))}
  function updateProfile(name:string,job:string,avatar?:string){if(!session.value)return;void apiRequest("/auth/me",{method:"PATCH",body:JSON.stringify({name,job,avatarKey:avatar?.startsWith("suggested:")?avatar:null})}).catch(()=>undefined);const account=accounts.value.find(a=>a.id===session.value!.accountId);if(account){account.name=name;account.job=job;account.avatar=avatar;account.initials=initials(name)};members.value=members.value.map(m=>m.id===session.value!.accountId?{...m,name,job,avatar,initials:initials(name)}:m);session.value={...session.value,name,initials:initials(name)};persist()}
  return{session,accounts,workspaces,memberships,invites,tasks,projects,members,prefs,admin,visibleTasks,visibleProjects,currentWorkspace,login,demo,logout,adoptAuthenticatedUser,register,switchWorkspace,createWorkspace,saveTask,removeTask,saveProject,saveMember,removeMember,updateProfile,persist};
});
