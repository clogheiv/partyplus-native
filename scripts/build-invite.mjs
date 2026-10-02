import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "../tests/load-ts.mjs";
const { validateBackendBoundary } = loadTs("src/lib/backendBoundary.ts");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environment = process.env.PARTYPLUS_BACKEND_ENV;
const url = process.env.PARTYPLUS_SUPABASE_URL;
const key = process.env.PARTYPLUS_SUPABASE_PUBLISHABLE_KEY;
const nativeScheme=process.env.PARTYPLUS_NATIVE_SCHEME ?? "partyplusnative-dev";
if (!["partyplusnative-dev","partyplusnative-preview"].includes(nativeScheme)) throw Error("Nonproduction invitations require a nonproduction native scheme.");
if (!["local","staging"].includes(environment)) throw Error("This candidate invitation build requires local or staging explicitly. Production publishing needs a separate reviewed release.");
const boundary = validateBackendBoundary(environment,url,key,true);
if (!boundary.configured) throw Error(boundary.reason);
if (key.startsWith("sb_secret_") || (key.startsWith("eyJ") && JSON.parse(Buffer.from(key.split(".")[1],"base64url")).role !== "anon")) {
  throw Error("Only a public/publishable key may enter the invitation bundle.");
}
const output = path.join(root,".test-cache/invite-site");
await fs.mkdir(output,{recursive:true});
for (const name of ["index.html","testflight.html","_redirects","assets"]) await fs.cp(path.join(root,"invite-web",name),path.join(output,name),{recursive:true});
await build({ entryPoints:[path.join(root,"invite-web/src/invite.ts")],outfile:path.join(output,"invite.js"),bundle:true,
  platform:"browser",format:"iife",target:"es2022",sourcemap:true,
  define: { __PARTYPLUS_CONFIG__:JSON.stringify({environment,url,key,nativeScheme}) }, });
console.log("Built isolated invitation site: .test-cache/invite-site");
