import { z } from "zod";

const environmentSchema=z.object({
  NODE_ENV:z.enum(["development","test","production"]).default("development"),
  API_HOST:z.string().default("127.0.0.1"),
  API_PORT:z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN:z.string().url().default("http://localhost:5173"),
  DATABASE_URL:z.string().min(1).optional()
});

export type Environment=z.infer<typeof environmentSchema>;
export function readEnvironment(source:NodeJS.ProcessEnv=process.env):Environment {
  return environmentSchema.parse(source);
}
