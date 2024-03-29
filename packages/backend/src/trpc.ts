import { initTRPC, TRPCError } from "@trpc/server";
import { NodeHTTPCreateContextFnOptions } from "@trpc/server/adapters/node-http";
import { clerkClient } from "@clerk/clerk-sdk-node";

interface Context extends NodeHTTPCreateContextFnOptions<any, any> {}

export async function createContext({ req }: Context) {
  const token = req.headers["authorization"];
  if (!token) return { user: null };

  try {
    const payload = await clerkClient.verifyToken(token);
    const user = await clerkClient.users.getUser(payload.sub);

    return { user };
  } catch (err) {
    console.error(err);
  }
}

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthorized = t.middleware((opts) => {
  if (!("user" in opts.ctx) || !opts.ctx.user)
    throw new TRPCError({ code: "UNAUTHORIZED" });

  return opts.next({
    ctx: {
      user: opts.ctx.user,
    },
  });
});

export const authedProcedure = t.procedure.use(isAuthorized);
