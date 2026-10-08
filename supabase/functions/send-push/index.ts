// Supabase Edge Function: send-push
// Aufrufarten:
//  1) App (mit Nutzer-JWT):  { kind: "completed", occurrence_id }  -> Push an Partner
//                            { kind: "test" }                      -> Push an sich selbst
//  2) pg_cron (Header x-cron-secret): { kind: "cron" }             -> fällige/überfällige Aufgaben
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// (JWT wird hier selbst geprüft, damit der Cron-Aufruf ohne Nutzer-Token funktioniert.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Payload = { title: string; body: string; url?: string; tag?: string };

async function sendTo(userIds: string[], payload: Payload) {
  if (!userIds.length) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id); // abgelaufen
      } else {
        console.error("push error", code, (e as Error).message);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // ---- Cron ----
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader) {
    if (!CRON_SECRET || cronHeader !== CRON_SECRET) return json({ error: "forbidden" }, 403);
    const { data, error } = await admin.rpc("get_due_notifications");
    if (error) return json({ error: error.message }, 500);

    // pro Person und Art bündeln
    const groups = new Map<string, { user: string; kind: string; titles: string[]; first: string }>();
    for (const r of data ?? []) {
      const key = `${r.out_user_id}|${r.out_kind}`;
      const g = groups.get(key) ?? { user: r.out_user_id, kind: r.out_kind, titles: [], first: r.out_occurrence_id };
      g.titles.push(r.out_title);
      groups.set(key, g);
    }
    let total = 0;
    for (const g of groups.values()) {
      const n = g.titles.length;
      const list = g.titles.slice(0, 3).join(", ") + (n > 3 ? ` +${n - 3}` : "");
      const payload: Payload =
        g.kind === "due"
          ? { title: n === 1 ? "Heute fällig" : `${n} Aufgaben heute fällig`, body: list,
              url: n === 1 ? `./#/task/${g.first}` : "./#/today", tag: "due" }
          : { title: n === 1 ? "Überfällig" : `${n} Aufgaben überfällig`, body: list,
              url: n === 1 ? `./#/task/${g.first}` : "./#/today", tag: "overdue" };
      total += await sendTo([g.user], payload);
    }
    return json({ ok: true, pushes: total });
  }

  // ---- Nutzer-Aufrufe ----
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  if (body.kind === "test") {
    const n = await sendTo([user.id], { title: "Duo Home", body: "Push-Benachrichtigungen funktionieren 🎉" });
    return json({ ok: true, pushes: n });
  }

  if (body.kind === "completed" && typeof body.occurrence_id === "string") {
    const { data: occ } = await admin
      .from("task_occurrences")
      .select("id, household_id, status, completed_by, points_awarded, tasks(title)")
      .eq("id", body.occurrence_id)
      .maybeSingle();
    if (!occ || occ.status !== "done" || occ.completed_by !== user.id) return json({ ok: true, pushes: 0 });

    const { data: me } = await admin.from("profiles").select("display_name, household_id").eq("id", user.id).single();
    if (!me || me.household_id !== occ.household_id) return json({ error: "forbidden" }, 403);
    const { data: others } = await admin
      .from("profiles").select("id").eq("household_id", me.household_id).neq("id", user.id);

    const title = (occ as unknown as { tasks: { title: string } | null }).tasks?.title ?? "Aufgabe";
    const n = await sendTo((others ?? []).map((o) => o.id), {
      title: `${me.display_name} hat etwas erledigt ✅`,
      body: `„${title}“ (+${occ.points_awarded ?? 0} Punkte)`,
      url: "./#/today",
      tag: "completed",
    });
    return json({ ok: true, pushes: n });
  }

  return json({ error: "bad request" }, 400);
});
