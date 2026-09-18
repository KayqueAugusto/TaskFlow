export interface KeyValueStorage {
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
}

export const STORAGE_VERSION = 1;
export const storageKeys = {
  version:"taskflow_storage_version",
  session:"taskflow_session",
  localContext:"taskflow_local_context",
  activeWorkspace:"taskflow_active_workspace_id",
  accounts:"taskflow_accounts",
  workspaces:"taskflow_workspaces",
  memberships:"taskflow_memberships",
  invites:"taskflow_invites",
  rememberEmail:"taskflow_remember_email",
  tasks:(workspaceId:number)=>`taskflow_tasks_${workspaceId}`,
  projects:(workspaceId:number)=>`taskflow_projects_${workspaceId}`,
  members:(workspaceId:number)=>`taskflow_members_${workspaceId}`,
  prefs:(accountId:number)=>`taskflow_prefs_${accountId}`
} as const;

export class LocalDataRepository {
  constructor(private readonly storage:KeyValueStorage) {}

  read<T>(key:string,fallback:T,validate?:(value:unknown)=>value is T):T {
    const raw=this.storage.getItem(key);
    if(raw===null)return fallback;
    try {
      const value:unknown=JSON.parse(raw);
      if(validate&&!validate(value))return fallback;
      return value as T;
    } catch {
      return fallback;
    }
  }

  write<T>(key:string,value:T):void {
    this.storage.setItem(storageKeys.version,String(STORAGE_VERSION));
    this.storage.setItem(key,JSON.stringify(value));
  }

  readText(key:string):string { return this.storage.getItem(key)??""; }
  writeText(key:string,value:string):void { this.storage.setItem(key,value); }
  remove(key:string):void { this.storage.removeItem(key); }
}

const browserStorage:KeyValueStorage=typeof window==="undefined"
  ? {getItem:()=>null,setItem:()=>undefined,removeItem:()=>undefined}
  : window.localStorage;
export const browserDataRepository=new LocalDataRepository(browserStorage);
