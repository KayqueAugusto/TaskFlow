import { buildApp } from "./app.js";
import { readEnvironment } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { AuthService, PrismaAuthRepository } from "./auth.js";
import { WorkspaceService } from "./workspaces.js";
import { BusinessService } from "./business.js";
import { access } from "node:fs/promises";

async function main() {
  const environment=readEnvironment();
  if(environment.NODE_ENV==="production")await access(new URL("../dist/index.html",import.meta.url));
  const prisma=new PrismaClient({datasources:{db:{url:environment.DATABASE_URL}},log:[]});
  const app=buildApp(environment,new AuthService(new PrismaAuthRepository(prisma)),new WorkspaceService(prisma,environment.APP_ORIGIN),new BusinessService(prisma),async()=>{await prisma.$queryRaw`SELECT 1`});
  app.addHook("onClose",async()=>{await prisma.$disconnect()});
  let closing=false;
  const shutdown=async()=>{
    if(closing)return;
    closing=true;
    const deadline=setTimeout(()=>process.exit(1),10000).unref();
    try {await app.close()} catch {process.exitCode=1} finally {clearTimeout(deadline)}
  };
  process.once("SIGTERM",shutdown);
  process.once("SIGINT",shutdown);
  try {
    await prisma.$connect();
    await app.listen({host:environment.NODE_ENV==="production"?"0.0.0.0":"127.0.0.1",port:environment.PORT});
  } catch {
    app.log.error("Falha ao iniciar a aplicação; verifique configuração e disponibilidade do banco.");
    process.exitCode=1;
    await shutdown();
  }
}
main().catch(()=>{process.stderr.write("Não foi possível iniciar: verifique as variáveis de ambiente e o build.\n");process.exitCode=1});
