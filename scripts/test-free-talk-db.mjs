// Uses an already-installed PGlite runtime, explicitly supplied by the caller. No network or production connection.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
let db, parallel;
const isolatedUrl = process.env.FREE_TALK_TEST_DATABASE_URL;
if (isolatedUrl) {
  const url = new URL(isolatedUrl);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/uzyra_free_talk_test"
  )
    throw new Error("Refusing a non-isolated database target");
  const { default: postgres } = await import("postgres");
  const pool = postgres(isolatedUrl, { max: 4, onnotice: () => {} });
  const connection = await pool.reserve();
  db = {
    query: async (text, args) => ({ rows: await connection.unsafe(text, args ?? []) }),
    exec: (sql) => connection.unsafe(sql).simple(),
    close: async () => {
      connection.release();
      await pool.end();
    },
  };
  parallel = (u, s) => pool.unsafe(`select public.free_talk_reserve('${id(u)}','${id(s)}')`);
} else {
  if (!process.env.PGLITE_MODULE)
    throw new Error(
      "Supply an existing PGLITE_MODULE or an explicitly isolated FREE_TALK_TEST_DATABASE_URL",
    );
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
  db = new PGlite();
}
let checks = 0;
const exec = (sql, args) =>
  !args && sql.trim().slice(0, -1).includes(";") ? db.exec(sql) : db.query(sql, args);
const expect = async (sql, value = true) => {
  const r = await exec(sql);
  assert.deepEqual(Object.values(r.rows[0])[0], value, sql);
  checks++;
};
const denied = async (sql, code) => {
  await assert.rejects(
    () => exec(sql),
    (e) => e.message.includes(code),
  );
  checks++;
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reserve = (u, s) => exec(`select public.free_talk_reserve('${id(u)}','${id(s)}')`);
try {
  await db.exec(
    await readFile(new URL("../supabase/tests/free-talk-fixture.sql", import.meta.url), "utf8"),
  );
  const migration = await readFile(
    new URL("../supabase/migrations/20261118010000_free_talk_time_budget.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  checks++;
  for (let n = 1; n <= 8; n++)
    await exec("insert into auth.users values($1,case when $2 then now() else null end)", [
      id(n),
      n !== 8,
    ]);
  await exec(
    `insert into public.user_roles values('${id(1)}','admin'); insert into public.user_plans values('${id(3)}','pro'),('${id(4)}','pro');`,
  );
  for (let n = 11; n <= 35; n++)
    await exec("insert into public.rita_v3_sessions values($1,$2)", [
      id(n),
      id(n === 13 ? 2 : n === 14 ? 8 : n === 15 ? 1 : 2),
    ]);
  await denied(`select public.free_talk_reserve('${id(2)}','${id(11)}')`, "free_talk_not_enabled");
  await exec("update public.free_talk_config set enabled=true");
  await expect(`select (public.free_talk_budget('${id(1)}')->>'unlimited')::boolean`);
  await expect(`select (public.free_talk_budget('${id(2)}')->>'remainingSeconds')::int`, 600);
  await denied(`select public.free_talk_budget('${id(8)}')`, "free_talk_email_unverified");
  await denied(`select public.free_talk_budget('${id(3)}')`, "free_talk_payment_unverified");
  await exec(
    `insert into public.subscriptions values('${id(4)}','pro','active',now()+interval '1 day','sandbox')`,
  );
  await denied(`select public.free_talk_budget('${id(4)}')`, "free_talk_payment_unverified");
  await exec("update public.subscriptions set environment='live'");
  await expect(`select (public.free_talk_budget('${id(4)}')->>'limitSeconds')::int`, 21600);
  await denied(
    `select public.free_talk_reserve('${id(3)}','${id(11)}')`,
    "free_talk_session_owner",
  );
  const attempts = await Promise.allSettled([
    (parallel ?? reserve)(2, 11),
    (parallel ?? reserve)(2, 12),
  ]);
  assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
  checks++;
  const live = attempts[0].status === "fulfilled" ? 11 : 12;
  await denied(
    `select public.free_talk_reserve('${id(2)}','${id(live)}')`,
    "free_talk_session_replayed",
  );
  await denied(
    `delete from public.rita_v3_sessions where id='${id(live)}'`,
    "violates foreign key constraint",
  );
  await exec(`select public.free_talk_claim('${id(live)}')`);
  await denied(`select public.free_talk_claim('${id(live)}')`, "free_talk_invalid_lease");
  await exec(`select public.free_talk_close('${id(2)}','${id(live)}')`);
  await expect(`select public.free_talk_bind('${id(live)}','late-worker')`, false);
  await denied(
    `select public.free_talk_reserve('${id(2)}','${id(13)}')`,
    "free_talk_already_active",
  );
  await exec(
    `select public.free_talk_settle('${id(live)}'); select public.free_talk_settle('${id(live)}')`,
  );
  await expect(`select (public.free_talk_budget('${id(2)}')->>'remainingSeconds')::int`, 600);
  await reserve(2, 13);
  await exec(
    `select public.free_talk_claim('${id(13)}');select public.free_talk_bind('${id(13)}','worker');`,
  );
  await exec(
    `update public.free_talk_sessions set created_at=clock_timestamp()-interval '600 seconds',deadline=clock_timestamp()-interval '0.01 seconds' where id='${id(13)}'`,
  );
  await denied(`select public.free_talk_reserve('${id(2)}','${id(16)}')`, "free_talk_exhausted");
  await exec(`select public.free_talk_settle('${id(13)}')`);
  await expect(`select charged_seconds from public.free_talk_sessions where id='${id(13)}'`, 600);
  await reserve(1, 15);
  await expect(`select reserved_seconds from public.free_talk_sessions where id='${id(15)}'`, 3600);
  for (const role of ["anon", "authenticated"]) {
    await exec("set role " + role);
    await denied(`select public.free_talk_budget('${id(1)}')`, "permission denied");
    await denied("select * from public.free_talk_sessions", "permission denied");
    await denied(`select public.activate_user_plan('${id(2)}','ultimate')`, "permission denied");
    await exec("reset role");
  }
  await expect(`select public.free_talk_close('${id(2)}','${id(15)}') is null`);
  await denied(
    `select public.free_talk_reserve('${id(8)}','${id(14)}')`,
    "free_talk_email_unverified",
  );
  for (let n = 60; n <= 66; n++)
    await exec("insert into public.rita_v3_sessions values($1,$2)", [id(n), id(5)]);
  for (let n = 60; n < 66; n++) {
    await reserve(5, n);
    await exec(`select public.free_talk_close('${id(5)}','${id(n)}')`);
    await denied(`select public.free_talk_claim('${id(n)}')`, "free_talk_invalid_lease");
  }
  await denied(
    `select public.free_talk_reserve('${id(5)}','${id(66)}')`,
    "free_talk_start_rate_limit",
  );
  await expect(
    `select bool_and(not has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and has_function_privilege('service_role',oid,'EXECUTE')) from pg_proc where pronamespace='public'::regnamespace and proname like 'free_talk_%'`,
  );
  await exec(`insert into public.rita_v3_sessions values('${id(41)}','${id(4)}')`);
  await exec(
    `insert into public.free_talk_sessions(id,user_id,period_key,reserved_seconds,charged_seconds,created_at,deadline,state,room_name) values('${id(41)}','${id(4)}','2000-01',3600,3600,'2000-01-01','2000-01-01 01:00Z','closed','old-month')`,
  );
  await expect(`select (public.free_talk_budget('${id(4)}')->>'remainingSeconds')::int`, 21600);
  await exec(`delete from auth.users where id='${id(1)}'`);
  await expect(`select count(*)::int from public.free_talk_sessions where user_id='${id(1)}'`,0);
  console.log(
    `PASS: ${checks} database quota checks (${isolatedUrl ? "PostgreSQL with independent concurrent connections" : "isolated PGlite; parallel requests serialized by runtime"}).`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
