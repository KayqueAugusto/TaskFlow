// Production entry point: pnpm start never silently starts in development mode.
process.env.NODE_ENV="production";
await import("./index.js");
export {};
