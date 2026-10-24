// Admin sign-in. Rate limited separately to slow down password guessing.
import type { Config } from "@netlify/functions";
import * as auth from "../../server/auth.js";
import { clean, readJson } from "../../server/validate.js";

export default async (req: Request) => {
  const { username, password } = await readJson(req);
  if (!auth.check(clean(username, 60), clean(password, 200))) {
    return Response.json({ error: 'Incorrect username or password.' }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': auth.issue() } });
};

export const config: Config = {
  path: "/api/admin/login",
  method: "POST",
  rateLimit: { windowSize: 60, windowLimit: 5, aggregateBy: ["ip", "domain"] },
};
