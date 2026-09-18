import { buildApp } from "./app.js";
import { readEnvironment } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { AuthService, PrismaAuthRepository } from "./auth.js";
import { WorkspaceService } from "./workspaces.js";

const environment=readEnvironment();
const prisma=new PrismaClient();
const app=buildApp(environment,new AuthService(new PrismaAuthRepository(prisma)),new WorkspaceService(prisma,environment.WEB_ORIGIN));
app.addHook("onClose",async()=>{await prisma.$disconnect()});
try {
  await app.listen({host:environment.API_HOST,port:environment.API_PORT});
} catch(error) {
  app.log.error(error);
  process.exitCode=1;
}
