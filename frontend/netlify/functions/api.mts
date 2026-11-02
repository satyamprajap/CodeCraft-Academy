import type { Config } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, sessions, progress } from "../../db/schema.js";

const COOKIE = "cc_token";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const cookieHeader = (value: string, maxAge: number) =>
  `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

type User = typeof users.$inferSelect;
const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

function readToken(req: Request) {
  const match = (req.headers.get("cookie") || "").match(/(?:^|;\s*)cc_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function startSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
  return cookieHeader(token, SESSION_SECONDS);
}

async function currentUser(req: Request) {
  const token = readToken(req);
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export default async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const method = req.method;

  try {
    if (path === "/api/health") return json({ status: "ok" });

    if (path === "/api/auth/register" && method === "POST") {
      const body = await readBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (name.length < 2 || name.length > 60) return json({ error: "Please enter your name." }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)
        return json({ error: "Enter a valid email." }, 400);
      if (password.length < 8 || password.length > 128)
        return json({ error: "Password must be between 8 and 128 characters." }, 400);

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) return json({ error: "Email is already registered." }, 409);

      const [user] = await db
        .insert(users)
        .values({ name, email, passwordHash: await bcrypt.hash(password, 10) })
        .returning();
      return json({ user: publicUser(user) }, 201, { "Set-Cookie": await startSession(user.id) });
    }

    if (path === "/api/auth/login" && method === "POST") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await bcrypt.compare(password, user.passwordHash)))
        return json({ error: "Incorrect email or password." }, 401);
      return json({ user: publicUser(user) }, 200, { "Set-Cookie": await startSession(user.id) });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      const token = readToken(req);
      if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }

    // Everything below requires a logged-in user.
    const user = await currentUser(req);
    if (!user) return json({ error: "Please log in first." }, 401);

    if (path === "/api/auth/me" && method === "GET") return json({ user: publicUser(user) });

    if (path === "/api/progress" && method === "GET") {
      const rows = await db.select().from(progress).where(eq(progress.userId, user.id));
      return json({
        progress: rows.map((r) => ({
          user_id: r.userId,
          module_id: r.moduleId,
          completed: r.completed,
          updated_at: r.updatedAt,
        })),
      });
    }

    const progressMatch = path.match(/^\/api\/progress\/([^/]+)$/);
    if (progressMatch && method === "PUT") {
      const moduleId = decodeURIComponent(progressMatch[1]).slice(0, 100);
      const body = await readBody(req);
      const completed = body.completed === true;
      await db
        .insert(progress)
        .values({ userId: user.id, moduleId, completed, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [progress.userId, progress.moduleId],
          set: { completed, updatedAt: new Date() },
        });
      return json({ moduleId, completed });
    }

    return json({ error: "Not found." }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

export const config: Config = {
  path: ["/api/health", "/api/auth/*", "/api/progress", "/api/progress/*"],
};
