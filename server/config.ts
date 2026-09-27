import { z } from "zod";

const localHost=(host:string)=>host==="localhost"||host.endsWith(".localhost")||host==="[::1]"||host.startsWith("127.")||host==="0.0.0.0";
const schema=z.object({
  NODE_ENV:z.enum(["development","test","production"]).default("development"),
  PORT:z.coerce.number().int().min(1).max(65535),
  APP_ORIGIN:z.string().url().refine(value=>{if(!URL.canParse(value))return false;const url=new URL(value);return url.origin===value&&["http:","https:"].includes(url.protocol)},"Use somente a origem exata."),
  DATABASE_URL:z.string().url().refine(value=>URL.canParse(value)&&["postgres:","postgresql:"].includes(new URL(value).protocol)),
  SESSION_SECRET:z.string().min(32),
  COOKIE_SECURE:z.enum(["true","false"]).transform(value=>value==="true")
}).superRefine((env,ctx)=>{
  if(env.NODE_ENV!=="production")return;
  const reject=(path:string)=>ctx.addIssue({code:"custom",path:[path],message:"Configuração insegura para produção."});
  if(!env.COOKIE_SECURE)reject("COOKIE_SECURE");
  if(!URL.canParse(env.APP_ORIGIN)||!URL.canParse(env.DATABASE_URL))return;
  const origin=new URL(env.APP_ORIGIN),database=new URL(env.DATABASE_URL);
  if(origin.protocol!=="https:"||localHost(origin.hostname))reject("APP_ORIGIN");
  if(localHost(database.hostname)||decodeURIComponent(database.password)==="taskflow_dev_only")reject("DATABASE_URL");
  if(new Set(env.SESSION_SECRET).size<16||/example|development|change.?me|replace/i.test(env.SESSION_SECRET))reject("SESSION_SECRET");
});

export type Environment=z.infer<typeof schema>;
export function readEnvironment(source:NodeJS.ProcessEnv=process.env):Environment {
  const production=source.NODE_ENV==="production";
  const result=schema.safeParse({...source,
    PORT:source.PORT??(!production?(source.API_PORT??"3001"):undefined),
    APP_ORIGIN:source.APP_ORIGIN??(!production?(source.WEB_ORIGIN??"http://localhost:5173"):undefined),
    SESSION_SECRET:source.SESSION_SECRET??(!production?"development-only-session-secret-not-for-production":undefined),
    COOKIE_SECURE:source.COOKIE_SECURE??(production?"true":"false")
  });
  if(!result.success)throw new Error(`Configuração inválida: ${[...new Set(result.error.issues.map(issue=>issue.path.join(".")))].join(", ")}`);
  return result.data;
}
