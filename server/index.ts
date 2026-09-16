import { buildApp } from "./app.js";
import { readEnvironment } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { AuthService, PrismaAuthRepository } from "./auth.js";

const environment=readEnvironment();
const prisma=new PrismaClient();
const app=buildApp(environment,new AuthService(new PrismaAuthRepository(prisma)));
try {
  await app.listen({host:environment.API_HOST,port:environment.API_PORT});
} catch(error) {
  app.log.error(error);
  process.exitCode=1;
} finally {
  await prisma.$disconnect();
}
