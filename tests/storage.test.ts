import { describe, expect, it } from "vitest";
import { LocalDataRepository, STORAGE_VERSION, storageKeys, type KeyValueStorage } from "../src/services/storage.js";

class MemoryStorage implements KeyValueStorage {
  private values=new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}

describe("LocalDataRepository",()=>{
  it("preserva as chaves e registra a versão",()=>{
    const storage=new MemoryStorage(),repository=new LocalDataRepository(storage);
    repository.write(storageKeys.tasks(42),[{id:1}]);
    expect(repository.read(storageKeys.tasks(42),[])).toEqual([{id:1}]);
    expect(storage.getItem(storageKeys.version)).toBe(String(STORAGE_VERSION));
  });
  it("ignora JSON legado inválido sem destruí-lo",()=>{
    const storage=new MemoryStorage();storage.setItem(storageKeys.session,"{inválido");
    const repository=new LocalDataRepository(storage);
    expect(repository.read(storageKeys.session,null)).toBeNull();
    expect(storage.getItem(storageKeys.session)).toBe("{inválido");
  });
});
