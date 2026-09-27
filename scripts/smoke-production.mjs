import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "@playwright/test";

// Local-only smoke. It creates its own database role and records in the TEST database.
const testUrl=new URL(process.env.DATABASE_URL_TEST||"postgresql://invalid/invalid");
assert.match(testUrl.pathname,/test/i,"DATABASE_URL_TEST must identify a test database");
assert.ok(["localhost","127.0.0.1"].includes(testUrl.hostname),"Smoke only runs against local PostgreSQL");
const admin=new PrismaClient({datasources:{db:{url:testUrl.href}}});
const role="smoke_"+randomBytes(6).toString("hex"),password=randomBytes(32).toString("hex");
const directory=path.resolve("outputs/production-smoke");
await mkdir(directory,{recursive:true});
const openssl=process.env.OPENSSL_BIN||(process.platform==="win32"?"C:/Program Files/Git/usr/bin/openssl.exe":"openssl");
const cert=path.join(directory,"cert.pem"),key=path.join(directory,"key.pem");
assert.equal(spawnSync(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=taskflow.test","-addext","subjectAltName=DNS:taskflow.test"],{stdio:"ignore",windowsHide:true}).status,0,"OpenSSL certificate generation");
const port=3100,tlsPort=3443,origin="https://taskflow.test:"+tlsPort;
const database=new URL(testUrl);
database.hostname=os.hostname();database.username=role;database.password=password;
database.searchParams.set("connection_limit","3");database.searchParams.set("pool_timeout","10");database.searchParams.set("connect_timeout","3");
const env={...process.env,NODE_ENV:"production",PORT:String(port),APP_ORIGIN:origin,COOKIE_SECURE:"true",SESSION_SECRET:randomBytes(48).toString("hex"),DATABASE_URL:database.href};
let child,browser,proxy,page,createdRole=false;
let logs="";
async function start(){
  assert.ok(process.env.npm_execpath,"Run through pnpm smoke:production");
  child=spawn(process.execPath,[process.env.npm_execpath,"start"],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  child.stdout.on("data",chunk=>{logs+=chunk});child.stderr.on("data",chunk=>{logs+=chunk});
  for(let i=0;i<60;i++){
    if(child.exitCode!==null)throw new Error("Production start failed (see sanitized server log)");
    try {const response=await globalThis.fetch("http://127.0.0.1:"+port+"/api/health");if(response.ok)return}catch{/* Wait for startup. */}
    await delay(250);
  }
  throw new Error("Production startup timed out");
}
async function stop(){
  if(!child||child.exitCode!==null)return;
  if(process.platform==="win32")spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});
  else child.kill("SIGTERM");
  await delay(500);
}
async function response(pathname){
  return globalThis.fetch("http://127.0.0.1:"+port+pathname);
}
try{
  await admin.$executeRawUnsafe('CREATE ROLE "'+role+'" LOGIN PASSWORD '+ "'"+password+"'");
  createdRole=true;
  await admin.$executeRawUnsafe('GRANT CONNECT ON DATABASE "'+testUrl.pathname.slice(1)+'" TO "'+role+'"');
  await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO "'+role+'"');
  await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "'+role+'"');
  await start();
  for(const route of ["/","/login","/cadastro","/dashboard","/tarefas","/projetos","/calendario","/equipe","/relatorios","/configuracoes","/projetos/test","/equipe/test/atividades","/invite/test"]){
    const result=await response(route);assert.equal(result.status,200,route);assert.match(result.headers.get("content-type"),/text\/html/);
  }
  for(const route of ["/api/missing","/api","/assets/missing.js","/missing.png","/.env","/server/index.ts","/unknown"]){
    const result=await response(route);assert.equal(result.status,404,route);assert.match(result.headers.get("content-type"),/application\/json/);
  }
  const html=await (await response("/dashboard")).text();
  const asset=html.match(/src="([^"]+\.js)"/)[1];
  const javascript=await (await response(asset)).text();
  assert.ok(!javascript.includes("localhost:3001"),"Production frontend must use /api");
  assert.ok(!javascript.includes("SESSION_SECRET"),"No backend secret configuration in frontend");
  assert.equal((await response("/favicon.svg")).status,200);
  const health=await response("/api/health");assert.equal(health.status,200);
  assert.match(health.headers.get("content-security-policy"),/script-src 'self'/);

  proxy=https.createServer({key:await readFile(key),cert:await readFile(cert)},(request,reply)=>{
    const upstream=http.request({hostname:"127.0.0.1",port,path:request.url,method:request.method,headers:{...request.headers,"x-forwarded-proto":"https","x-forwarded-for":"127.0.0.1"}},result=>{
      reply.writeHead(result.statusCode,result.headers);result.pipe(reply);
    });
    upstream.on("error",()=>{reply.writeHead(502);reply.end()});request.pipe(upstream);
  });
  await new Promise(resolve=>proxy.listen(tlsPort,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,args:["--host-resolver-rules=MAP taskflow.test 127.0.0.1","--no-proxy-server"]});
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  page=await context.newPage();const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error"&&/Content Security Policy|Refused to/.test(message.text()))errors.push(message.text())});
  await page.goto(origin+"/dashboard");await expect(page).toHaveURL(origin+"/login");
  await page.goto(origin+"/cadastro");
  const email="smoke-"+Date.now()+"@example.test",userPassword=randomBytes(18).toString("hex");
  await page.getByLabel("Nome completo").fill("Smoke Production");
  await page.getByLabel("E-mail",{exact:true}).fill(email);
  await page.getByLabel("Cargo/função profissional").fill("QA");
  await page.getByLabel("Senha",{exact:true}).fill(userPassword);
  await page.getByLabel("Confirmar senha").fill(userPassword);
  await page.locator(".login-submit").click();
  await expect(page).toHaveURL(origin+"/dashboard");
  const session=(await context.cookies()).find(cookie=>cookie.name==="taskflow_session");
  assert.ok(session?.secure&&session.httpOnly&&session.sameSite==="Lax");
  assert.ok(!(await page.evaluate(()=>globalThis.document.cookie)).includes("taskflow_session"));
  await page.reload();await expect(page.getByRole("heading",{name:/Olá, Smoke/})).toBeVisible();
  await page.locator(".profile-main").click();
  await page.getByRole("button",{name:"Meu perfil",exact:true}).click();
  await page.locator(".profile-editor dd input").first().fill("Smoke Updated");
  await page.getByRole("button",{name:"Salvar perfil",exact:true}).click();
  await expect(page.locator(".profile-main")).toContainText("Smoke Updated");

  await page.locator(".profile-main").click();await page.getByRole("button",{name:"Trocar workspace"}).click();
  await page.getByRole("button",{name:"Criar novo workspace"}).click();
  await page.getByPlaceholder("Nome do novo workspace").fill("Smoke Workspace");
  await page.getByRole("button",{name:"Criar",exact:true}).click();
  await expect(page.locator(".workspace-label")).toContainText("Smoke Workspace");
  await page.getByRole("button",{name:"Projetos",exact:true}).click();
  await page.getByRole("button",{name:"Novo projeto",exact:true}).click();
  await page.getByLabel("Nome",{exact:true}).fill("Smoke Project");
  await page.getByLabel("Descrição",{exact:true}).fill("Production persistence verification");
  await page.getByRole("button",{name:"Criar projeto",exact:true}).click();
  await page.getByRole("heading",{name:"Smoke Project",exact:true}).click();
  await page.getByRole("button",{name:"Nova tarefa",exact:true}).click();
  await page.getByLabel("Título",{exact:true}).fill("Smoke Task");
  await page.getByLabel("Descrição",{exact:true}).fill("Persisted task");
  await page.getByRole("button",{name:"Salvar",exact:true}).click();
  await expect(page.locator("tr").filter({hasText:"Smoke Task"})).toBeVisible();
  await page.locator("tr").filter({hasText:"Smoke Task"}).click();
  await page.locator(".modal-fields select").nth(3).selectOption({label:"Concluída"});
  await page.getByRole("button",{name:"Salvar",exact:true}).click();
  await expect(page.locator("tr").filter({hasText:"Smoke Task"})).toContainText("Concluída");
  await page.getByRole("button",{name:"Dashboard",exact:true}).click();
  await expect(page.locator(".metric-card").filter({hasText:"Concluídas"}).locator("strong")).toHaveText("1");
  await page.getByRole("button",{name:"Calendário",exact:true}).click();
  await expect(page.getByText("Smoke Task",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Relatórios",exact:true}).click();
  await expect(page.getByText("100%",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("Smoke Project",{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(directory,"reports.png"),fullPage:true});
  await stop();await start();
  await page.goto(origin+"/dashboard");
  await expect(page.getByText("Smoke Task",{exact:true})).toBeVisible();
  await expect(page.locator(".profile-main")).toContainText("Smoke Updated");
  await page.locator(".profile-main").click();await page.getByRole("button",{name:"Sair",exact:true}).click();
  await expect(page).toHaveURL(origin+"/login");
  assert.ok(!(await context.cookies()).some(cookie=>cookie.name==="taskflow_session"));
  await page.goto(origin+"/dashboard");await expect(page).toHaveURL(origin+"/login");
  await page.getByLabel("E-mail",{exact:true}).fill(email);await page.getByLabel("Senha",{exact:true}).fill(userPassword);
  await page.getByRole("button",{name:/Entrar/}).click();await expect(page).toHaveURL(origin+"/dashboard");
  await expect(page.getByText("Smoke Task",{exact:true})).toBeVisible();
  assert.deepEqual(errors,[],"Browser JS/CSP errors");
  await page.screenshot({path:path.join(directory,"dashboard.png"),fullPage:true});
  await writeFile(path.join(directory,"result.json"),JSON.stringify({passed:true,checks:["SPA direct routes and refresh","API and asset 404","health with PostgreSQL","register/login/session/profile/logout","workspace/project/task/status","Dashboard/Calendar/Reports","Secure/HttpOnly/Lax cookie","persistence and session after restart","no JS or CSP errors"],platform:process.platform},null,2));
  process.stdout.write("Production browser smoke: PASS (including restart and persistence).\n");
} catch(error) {
  if(page){await page.screenshot({path:path.join(directory,"failure.png"),fullPage:true});await writeFile(path.join(directory,"failure.txt"),await page.locator("body").innerText())}
  throw error;
} finally {
  await browser?.close();
  if(proxy)await new Promise(resolve=>proxy.close(resolve));
  await stop();
  // Logs deliberately omit raw requests, cookies, credentials and Prisma errors.
  await writeFile(path.join(directory,"server.log"),logs);
  if(createdRole){
    await admin.$executeRawUnsafe('DROP OWNED BY "'+role+'"');
    await admin.$executeRawUnsafe('DROP ROLE "'+role+'"');
  }
  await admin.$disconnect();
}
