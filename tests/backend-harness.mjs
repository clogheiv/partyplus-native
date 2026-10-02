import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export const users = {
  host: "10000000-0000-4000-8000-000000000001",
  otherHost: "10000000-0000-4000-8000-000000000002",
  guestA: "20000000-0000-4000-8000-000000000001",
  guestB: "20000000-0000-4000-8000-000000000002",
  unverified: "30000000-0000-4000-8000-000000000001",
};
export async function backendHarness() {
  const connectionString = process.env.PARTYPLUS_TEST_DATABASE_URL;
  let db, pool;
  if (connectionString) {
    const url = new URL(connectionString);
    if (!["localhost","127.0.0.1","[::1]"].includes(url.hostname) || url.pathname !== "/partyplus_synthetic") {
      throw Error("Tests require a loopback database named partyplus_synthetic; remote connections are refused.");
    }
    pool = new pg.Pool({ connectionString, max: 8 });
    db = { exec: sql => pool.query(sql), query: (sql,args) => pool.query(sql,args) };
  } else db = new PGlite();
  await db.exec("select set_config('partyplus.environment','synthetic',false)");
  // Pool sessions do not retain session settings: mark each SQL installation explicitly.
  for (const name of ["00-synthetic-baseline.sql","10-v2-contract.sql"]) {
    await db.exec("select set_config('partyplus.environment','synthetic',false);\n" + await fs.readFile("supabase/nonproduction/" + name,"utf8"));
  }
  for (const [name,id] of Object.entries(users)) {
    await db.query("insert into auth.users(id,is_anonymous,email_confirmed_at) values($1,$2,$3)",
      [id,name.startsWith("guest"),name === "host" || name === "otherHost" ? "2026-01-01" : null]);
  }
  async function transaction(principal, role, fn) {
    const apply = async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[principal ?? ""]);
      if (!["anon","authenticated","postgres"].includes(role)) throw Error("Invalid test role");
      await tx.query("set local role " + role);
      return fn(tx);
    };
    if (!pool) return db.transaction(apply);
    const client = await pool.connect();
    try { await client.query("begin"); const result = await apply(client); await client.query("commit"); return result; }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  }
  return {
    db, concurrentSessions: Boolean(pool), transaction,
    async rpc(principal,name,args,role="authenticated") {
      if (!/^partyplus_v2_[a-z_]+$/.test(name)) throw Error("Invalid function name");
      return transaction(principal,role,async tx => {
        const result = await tx.query("select public." + name + "(" + args.map((_,i) => "$" + (i+1)).join(",") + ") as result",args);
        return result.rows[0].result;
      });
    },
    close: () => pool ? pool.end() : db.close(),
  };
}
