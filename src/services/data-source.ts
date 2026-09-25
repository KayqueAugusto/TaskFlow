import type { Member, Project, Task } from "../domain/models.js";

export interface WorkspaceData {
  tasks:Task[];
  projects:Project[];
  members:Member[];
}

export interface TaskFlowDataSource {
  loadWorkspace(workspaceId:string):Promise<WorkspaceData>;
  saveTask(workspaceId:string,task:Task):Promise<Task>;
  deleteTask(workspaceId:string,taskId:string):Promise<void>;
  saveProject(workspaceId:string,project:Project):Promise<Project>;
  deleteProject(workspaceId:string,projectId:string):Promise<void>;
}

export type ApiSuccess<T>={data:T;meta?:Record<string,unknown>};
export type ApiFailure={error:{code:string;message:string;details?:unknown}};
