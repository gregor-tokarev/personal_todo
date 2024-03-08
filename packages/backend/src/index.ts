import { serve } from "@hono/node-server";
import { Hono } from "hono";
import postgres from "postgres";
import * as schema from "./models/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import tasks from "./routes/task";

config({ path: ".env.local" });

const app = new Hono();

const pg = postgres(process.env.DATABASE_URL ?? "");
export const db = drizzle(pg, { schema });

app.use(logger());
app.use(
  cors({
    allowHeaders: ["*"],
    allowMethods: ["*"],
    origin: ["http://localhost:5173", "https://todo.tokarev.work"],
  }),
);
app.use("*", clerkMiddleware());
app.use("*", async (c, next) => {
  const auth = getAuth(c);

  if (auth?.userId) await next();

  c.status(401);
  return c.json({ message: "Unauthorized" });
});

app.route("/tasks", tasks);

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
