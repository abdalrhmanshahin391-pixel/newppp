// Uses an already-installed PGlite runtime, explicitly supplied by the caller. No network or production connection.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
let db, parallel, parallelBoard;
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
  parallelBoard = (u, ms, ref) =>
    pool.unsafe(`select public.voice_board_charge('${id(u)}',${ms},'${ref}')->>'charged' as c`);
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
  await expect(`select count(*)::int from public.free_talk_sessions where user_id='${id(1)}'`, 0);
  // One budget for every call, renewed each day (20261126180000_daily_voice_budget.sql).
  const daily = await readFile(
    new URL("../supabase/migrations/20261126180000_daily_voice_budget.sql", import.meta.url),
    "utf8",
  );
  await db.exec(daily);
  await db.exec(daily);
  await exec(`insert into auth.users values('${id(70)}',now())`);
  for (const n of [71, 72, 73])
    await exec(`insert into public.rita_v3_sessions values('${id(n)}','${id(70)}')`);
  await exec(
    "update public.plans set free_talk_seconds=1800,free_talk_period='daily' where slug='starter'",
  );
  await expect(
    `select public.free_talk_budget('${id(70)}')->>'period' = to_char(now() at time zone 'Asia/Amman','YYYY-MM-DD')`,
  );
  await expect(`select (public.free_talk_budget('${id(70)}')->>'remainingSeconds')::int`, 1800);
  await expect(
    `select (public.free_talk_budget('${id(70)}')->>'resetsAt')::timestamptz = (date_trunc('day',now() at time zone 'Asia/Amman')+interval '1 day') at time zone 'Asia/Amman'`,
  );
  // Free talk switched off: a lesson call still gets its time, a free conversation does not.
  await exec("update public.free_talk_config set enabled=false");
  await denied(`select public.free_talk_reserve('${id(70)}','${id(71)}')`, "free_talk_not_enabled");
  await expect(
    `select (public.free_talk_reserve('${id(70)}','${id(72)}',false)->>'reservedSeconds')::int`,
    1800,
  );
  // Yesterday's calls do not count today.
  await exec(
    `update public.free_talk_sessions set state='closed',charged_seconds=1800,period_key='2000-01-01' where id='${id(72)}'`,
  );
  await expect(`select (public.free_talk_budget('${id(70)}')->>'remainingSeconds')::int`, 1800);
  // Today's calls do.
  await exec(
    `update public.free_talk_sessions set period_key=to_char(now() at time zone 'Asia/Amman','YYYY-MM-DD') where id='${id(72)}'`,
  );
  await denied(
    `select public.free_talk_reserve('${id(70)}','${id(73)}',false)`,
    "free_talk_exhausted",
  );
  await expect(
    `select bool_and(not has_function_privilege('authenticated',oid,'EXECUTE') and has_function_privilege('service_role',oid,'EXECUTE')) from pg_proc where pronamespace='public'::regnamespace and proname like 'free_talk_%'`,
  );
  // Groq requests a month (20261126190000_groq_request_quota.sql).
  const groq = await readFile(
    new URL("../supabase/migrations/20261126190000_groq_request_quota.sql", import.meta.url),
    "utf8",
  );
  await db.exec(groq);
  await db.exec(groq);
  await exec("update public.plans set max_groq_requests=2 where slug='starter'");
  await exec(`insert into auth.users values('${id(90)}',now())`);
  await expect(`select (public.groq_request_take_for('${id(90)}')->>'used')::int`, 1);
  await expect(`select (public.groq_request_take_for('${id(90)}')->>'used')::int`, 2);
  await denied(`select public.groq_request_take_for('${id(90)}')`, "groq_requests_used");
  // Last month's requests do not count this month.
  await exec(`update public.groq_request_usage set period='2000-01' where user_id='${id(90)}'`);
  await expect(`select (public.groq_request_take_for('${id(90)}')->>'used')::int`, 1);
  // A paid plan with no payment evidence gets the free cap.
  await exec(
    `insert into public.user_plans values('${id(70)}','ultimate') on conflict(user_id) do update set plan_slug='ultimate'`,
  );
  await exec("update public.plans set max_groq_requests=1000 where slug='ultimate'");
  await expect(`select (public.groq_request_take_for('${id(70)}')->>'limit')::int`, 2);
  await expect(
    `select not has_function_privilege('authenticated','public.groq_request_take_for(uuid)','EXECUTE') and has_function_privilege('authenticated','public.groq_request_take()','EXECUTE') and not has_table_privilege('authenticated','public.groq_request_usage','SELECT')`,
  );
  // One voice time for calls and the whiteboard (20261127200000_voice_board_time.sql).
  const board = await readFile(
    new URL("../supabase/migrations/20261127200000_voice_board_time.sql", import.meta.url),
    "utf8",
  );
  await db.exec(board);
  await db.exec(board);
  await expect("select enabled from public.free_talk_config");
  await exec(
    "update public.plans set free_talk_seconds=120,free_talk_period='daily' where slug='starter'",
  );
  for (const n of [100, 101, 102, 103])
    await exec(`insert into auth.users values('${id(n)}',now())`);
  for (const [s, u] of [
    [201, 100],
    [202, 101],
    [203, 102],
  ])
    await exec(`insert into public.rita_v3_sessions values('${id(s)}','${id(u)}')`);
  const charge = (u, ms, ref, field = "charged") =>
    `select public.voice_board_charge('${id(u)}',${ms},'${ref}')->>'${field}'`;
  const left = (u) => `select (public.free_talk_budget('${id(u)}')->>'remainingSeconds')::int`;
  // A clip takes its exact length; the total counts up to the next second.
  await expect(left(100), 120);
  await expect(charge(100, 30500, "board-test-001", "leftMs"), "89500");
  await expect(left(100), 89);
  // The same clip is never charged twice, and another account cannot reuse its id.
  await expect(charge(100, 30500, "board-test-001", "repeat"), "true");
  await expect(
    `select count(*)::int from public.voice_board_charges where user_id='${id(100)}'`,
    1,
  );
  await denied(charge(101, 1000, "board-test-001"), "voice_board_invalid");
  // Never below zero: a clip longer than what is left is refused, exactly the rest is fine.
  await expect(charge(100, 89501, "board-test-002", "reason"), "exhausted");
  await expect(charge(100, 89500, "board-test-003"), "true");
  await expect(left(100), 0);
  await expect(charge(100, 1, "board-test-004", "reason"), "exhausted");
  await denied(`select public.free_talk_reserve('${id(100)}','${id(201)}')`, "free_talk_exhausted");
  // An open call holds all the time; after it ends, the board gets only what the call left.
  await expect(
    `select (public.free_talk_reserve('${id(101)}','${id(202)}')->>'reservedSeconds')::int`,
    120,
  );
  await expect(charge(101, 1000, "board-test-101", "reason"), "call");
  await exec(
    `select public.free_talk_claim('${id(202)}');select public.free_talk_bind('${id(202)}','call');`,
  );
  await exec(
    `update public.free_talk_sessions set created_at=clock_timestamp()-interval '39.2 seconds' where id='${id(202)}'`,
  );
  await exec(`select public.free_talk_settle('${id(202)}')`);
  await expect(`select charged_seconds from public.free_talk_sessions where id='${id(202)}'`, 40);
  await expect(charge(101, 80000, "board-test-102", "leftMs"), "0");
  await expect(charge(101, 1, "board-test-103", "reason"), "exhausted");
  // Board first: a call then only gets the rest.
  await exec(charge(102, 59001, "board-test-201"));
  await expect(
    `select (public.free_talk_reserve('${id(102)}','${id(203)}')->>'reservedSeconds')::int`,
    60,
  );
  // Simultaneous clips cannot both take the last seconds.
  const race = await Promise.allSettled(
    [1, 2, 3].map((n) =>
      parallelBoard
        ? parallelBoard(103, 70000, `board-race-00${n}`)
        : exec(charge(103, 70000, `board-race-00${n}`)),
    ),
  );
  assert.equal(
    race.filter(
      (r) =>
        r.status === "fulfilled" && Object.values(r.value.rows?.[0] ?? r.value[0])[0] === "true",
    ).length,
    1,
  );
  checks++;
  await denied(charge(103, 0, "board-test-501"), "voice_board_invalid");
  await denied(charge(103, 600001, "board-test-502"), "voice_board_invalid");
  // Yesterday's clips do not count today.
  await exec(
    `update public.voice_board_charges set period_key='2000-01-01' where user_id='${id(100)}'`,
  );
  await expect(left(100), 120);
  for (const role of ["anon", "authenticated"]) {
    await exec("set role " + role);
    await denied(charge(100, 10, "board-test-601"), "permission denied");
    await denied("select * from public.voice_board_charges", "permission denied");
    await exec("reset role");
  }
  console.log(
    `PASS: ${checks} database quota checks (${isolatedUrl ? "PostgreSQL with independent concurrent connections" : "isolated PGlite; parallel requests serialized by runtime"}).`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
