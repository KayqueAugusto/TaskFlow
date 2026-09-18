export type Role = "Administrador" | "Membro";
export type Status = "Pendente" | "Em andamento" | "Concluída";
export type Priority = "Alta" | "Média" | "Baixa";

export interface Account { id:number; name:string; email:string; password:string; job:string; initials:string; avatar?:string }
export interface Member { id:number; name:string; email:string; job:string; role:Role; initials:string; color:string; blocked?:boolean; avatar?:string; membershipId?:string; permissionRole?:"OWNER"|"ADMIN"|"MEMBER";workspaceJob?:string|null }
export interface Project { id:number; name:string; description:string; start:string; due:string; members:number[]; color:string }
export interface Task { id:number; title:string; projectId:number; due:string; status:Status; priority:Priority; assigneeId:number; description:string }
export interface Session { accountId:number; memberId:number; workspaceId:number; name:string; email:string; role:Role; initials:string }
export interface Workspace { id:number; name:string; ownerId:number }
export interface Membership { accountId:number; workspaceId:number; role:Role }
export interface Invite { id:number; workspaceId:number; workspaceName:string; email:string; job:string; role:Role; status:"Pendente"|"Aceito"|"Recusado" }
export interface Prefs { notifications:boolean; compact:boolean; weekly:boolean; theme:"Claro"|"Escuro"|"Sistema" }
