# Optional password sign-in without changing party identity

This follows the urgent bring-item correction; it is not a dependency of that release. No backend migration, new service, account replacement, or global verification change is required.

## Verified API contract and identity

For an already verified email account, use `auth.updateUser({password})`. The authenticated user's UUID remains the owner; existing `host_access`, memberships, responses and claims continue referencing that UUID. Returning users can call `auth.signInWithPassword({email,password})`. Keep the email-code alternative and current persisted/refreshing Supabase session. Never create a second account to add a password. These are supported SDK operations. Sources: [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

Show “Set or change password” on the verified account screen, using password and confirmation inputs with `autocomplete="new-password"`; login uses `autocomplete="current-password"`. Check actual server user identity/verification before changing credentials and verify the returned UUID matches the current account. Do not infer password presence by exposing password hashes or adding client-readable Auth columns. Password values remain transient form state; never put them in local storage, drafts, pending RPC records, URLs, telemetry or logs. Do not trim passwords. Clear their state after success or leaving the form.

Anonymous invitation participation stays available. Existing email verification/manual linking preserves the guest UUID before the account can add a password. Moving to a different existing account still requires the existing explicit guest-session warning; toggling a login method must not silently end the guest session or reassign its rows.

## Recovery and server protections

The smallest complete recovery flow is **“Use an email code instead” → existing verified account sign-in → set a new password**. For a dedicated recovery request, use `signInWithOtp` with `shouldCreateUser:false`; keep the normal new-host code path's signup behavior separate. Preserve a generic response for an unknown email. A newly verified session then changes its own password; the UUID and party access stay the same.

`resetPasswordForEmail` is also supported, but its standard link flow needs a real recovery callback, allowed redirect URL, and `PASSWORD_RECOVERY`/PKCE handling. The current client explicitly sets `detectSessionInUrl:false`, and the reset-email template was not changed by the website release. Merely adding that API call would not complete recovery. An explicit recovery-code design would instead need the appropriate template and `verifyOtp` recovery type. The existing email-code route avoids new callback/template settings for the initial optional-password release. Source: [password reset reference](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

Keep configured password-strength and reauthentication rules. If the server requires reauthentication, either obtain a fresh email-code session or use `reauthenticate()` and pass the user-supplied nonce to `updateUser`. Current-password enforcement, if enabled, needs its supported SDK field. Do not disable these rules to make the form work. Wrong passwords, weak passwords, throttling and expired sessions need distinct useful feedback without logging credentials. Source: [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

## Focused verification, October 31

Public read-only `/auth/v1/settings` checks returned HTTP 200 for both current production and staging: Email enabled, anonymous sign-ins enabled, email confirmation required, and signup permitted. The public endpoint does not expose password-strength or old-session reauthentication policy; no claim is made that these were inspected or changed. No production record, credential or setting was changed by these checks.

`scripts/verify-staging-password-identity.mjs` passed eight real Auth checks using a **new synthetic staging account**, initially confirmed without a password, and administrative generated OTPs:

- Add password to the existing verified principal and retain its UUID.
- Reject an incorrect password without creating a session.
- Fresh password sign-in returns the same UUID.
- Hosting and Joined lists retain exactly the same parties and data.
- OTP remains an alternative for that same identity.
- A new password after OTP sign-in works; the replaced password is rejected.

Evidence: `supabase/web-rebuild/PASSWORD_IDENTITY_CHECK_2026-10-31.json`. No email was sent, no reviewer/customer credential changed, and no global setting or production write occurred. Generated-OTP evidence proves API/identity behavior, not recipient delivery, browser password-manager behavior or old-session reauthentication handling. Existing production email delivery was verified in the preceding release; the new forms still need focused client validation.

The separate real staging bring-item check passed: explicitly submitted Dessert/quantity survived create/read/replay/fresh host sign-in/edit while retaining stable item identity, the guest's claim and RSVP. The released editor submitted `draft.items` while pending `itemName`/`itemQty` lived outside that draft. This supports correcting pending-input inclusion and draft recovery rather than changing the persistence contract or editing Michael's actual party.

## Implemented browser API boundary

`web/src/api.ts` now exports `api.signInWithPassword(email,password):Promise<void>` and `api.setPassword(password):Promise<void>`. The former refuses to replace an active guest or a different signed-in account, checks the confirmed response identity, and keeps normal persisted/refreshing SDK sessions. The latter requires a signed nonanonymous local session, an independently retrieved verified server user with the same UUID, an eight-character client minimum, and a matching verified update response. Neither method writes a password to browser storage or party/measurement RPCs, signs out on failure, creates another account, or changes server settings. Server reauthentication errors instruct fresh email-code sign-in.

Seven focused client tests cover successful session configuration and unchanged password text, guest/account-switch protection, generic credential failures, server identity validation, unverified/mismatched principal rejection, response-identity mismatch, and useful policy/reauth/network errors while preserving drafts. These and the six existing API reliability tests passed **13/13**; targeted ESLint and the web TypeScript check passed. The integration lead owns the new account UI and its focused loopback rendering/interaction checks.

The bounded recovery review added `api.sendRecoveryCode(email):Promise<void>`, which always passes `shouldCreateUser:false`, never invokes email linking, and refuses to replace a guest or different signed-in account. Known unknown-account responses take the same generic accepted path as other recovery requests; the UI must say “If this account can receive a code…” rather than assert delivery. Normal new-host `sendCode` remains signup-capable. Four additional focused tests cover these boundaries and non-enumerating error handling; **17/17** API tests and the web TypeScript check pass.
