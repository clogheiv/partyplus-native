import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./load-ts.mjs";
const {routeFromUrl}=loadTs("src/lib/deepLinkRouting.ts");
for(const link of ["https://partyplus-invite.netlify.app/i/old-id", "partyplusnative://party/old-id", "partyplusnative:///i/old-id",
  "partyplusnative://share?id=old-id", "partyplusnative://__share?id=old-id", "partyplusnative://_share?id=old-id",
  "intent://party/old-id#Intent;scheme=partyplusnative;end", "exp://192.168.1.2:8081/--/party/old-id",
  "partyplusnative-dev://party/old-id", "partyplusnative-preview://i/old-id"]) {
  test("preserves legacy invite ID: "+link,()=>assert.equal(routeFromUrl(link)?.params?.id,"old-id"));
}
test("retains legacy payload aliases without granting ownership",()=>{
  for(const alias of ["d","data","payload"]) assert.equal(routeFromUrl("partyplusnative://i/old-id?"+alias+"=legacy-payload")?.params.d,"legacy-payload");
});
test("decodes IDs once and rejects malformed or unrelated deep links",()=>{
  assert.equal(routeFromUrl("partyplusnative://i/legacy%20id")?.params.id,"legacy id");
  for(const url of ["garbage","javascript:alert(1)","https://unrelated.example/i/id","partyplusnative://i/a%2Fb","partyplusnative://i/%ZZ"]) assert.equal(routeFromUrl(url),null);
});
