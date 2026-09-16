import type { Member, Project, Task } from "../domain/models.js";

export interface WorkspaceData {
  tasks:Task[];
  projects:Project[];
  members:Member[];
}

export interface TaskFlowDataSource {
  loadWorkspace(workspaceId:number):Promise<WorkspaceData>;
  saveTask(workspaceId:number,task:Task):Promise<Task>;
  deleteTask(workspaceId:number,taskId:number):Promise<void>;
  saveProject(workspaceId:number,project:Project):Promise<Project>;
}

export type ApiSuccess<T>={data:T;meta?:Record<string,unknown>};
export type ApiFailure={error:{code:string;message:string;details?:unknown}};
