# Transactional email setup

_Decided 2026-08-19. Needed before self-serve password reset is real. Everything here is Andre's to do; Claude Code's part is the app code, which assumes working email._

## Why this can't be skipped

Supabase's built-in email sender is **rate limited to a couple of messages an hour across the whole project** and is documented as testing-only. With eight users able to click "forgot password", the first person would get an email and the rest would get silence — no error, no bounce, nothing on screen. Custom SMTP is the difference between the feature working and appearing to work.

## The trap that caught us before

On a previous project (Catchment) Resend emails **never arrived at all**. The overwhelmingly likely cause is sending from `onboarding@resend.dev` — the provider's test domain, which only delivers to the address that owns the account. Every other recipient is silently dropped.

**So the single most important step below is verifying a real sending domain before trusting a single test.**

## The other trap: Microsoft 365

Every WakudOS recipient is on M365 (`@wakud.com`, `@the-utopia.world`). Exchange Online Protection is unusually strict with senders that have no reputation history, and password-reset mail trips several of its heuristics at once: transactional, link-heavy, urgent wording, unfamiliar domain. This is survivable but only if the domain authentication is complete — half-configured DKIM is worse than none, because it looks like spoofing.

## Setup

### 1. Pick the provider

**Postmark** is the safer choice given we've been burned once — transactional deliverability is the entire product, and it keeps transactional and broadcast streams separate so marketing mail can never damage the reputation that password resets depend on.

**Resend** is fine too and has a more generous free tier. The earlier failure was almost certainly the test-domain issue rather than the service.

Either covers eight users many times over.

### 2. Use a SUBDOMAIN as the sending domain

Add **`mail.wakud.com`** (or `notify.wakud.com`), **not** `wakud.com`.

Two reasons, both real:

- **Reputation isolation.** If transactional mail ever gets flagged, it doesn't drag down the root domain that M365 uses for everyone's ordinary business email.
- **You never touch the live SPF record.** `wakud.com`'s SPF already authorises Microsoft. Editing it to add a third party risks breaking normal mail delivery for the whole company, and SPF permits only one TXT record per domain — a second one silently invalidates both.

### 3. DNS records

The provider gives you the exact values. Expect three, all on the subdomain:

| Type | Host | Purpose |
|---|---|---|
| TXT | `mail.wakud.com` | SPF — authorises the provider to send as this subdomain |
| CNAME (usually ×2) | provider-specified | DKIM — cryptographic signing |
| TXT | `_dmarc.mail.wakud.com` | DMARC — start at `p=none` and only tighten once mail is landing |

DNS for `wakud.com` is likely managed by Oryx or the registrar — **this may need to go in the batched Oryx message**, so raise it early rather than discovering the dependency at the end.

**Wait for the provider to show the domain as verified before sending anything.** Not "records added" — verified.

### 4. Wire it into Supabase

Dashboard → **Authentication → SMTP Settings**:

- Host / port 587 / username / password from the provider
- Sender: `noreply@mail.wakud.com`
- Sender name: `WakudOS`

Then **Authentication → URL Configuration**:

- Site URL: the production Vercel URL
- Redirect allow-list must include `/reset-password` on both the production URL and `http://localhost:3000` for local testing — the reset link fails silently if the redirect target isn't allow-listed.

Also raise Supabase's own email rate limit once custom SMTP is in — it stays low by default.

### 5. Test properly

Not "send a test email to myself". Test the actual failure case:

1. Trigger a password reset for a **real `@wakud.com` mailbox that is not yours**.
2. Confirm it lands in the **inbox**, not Junk.
3. Check the message headers show `SPF=pass`, `DKIM=pass`, `DMARC=pass`.
4. Repeat for a `@the-utopia.world` address — different mailbox policies may apply.
5. Click the link end to end and confirm the password actually changes.

If it lands in Junk, do not tell people to check their junk folder. Fix the authentication.

### 6. Keep the admin fallback

The per-user reset button on `/admin` stays regardless. It's the escape hatch when someone has lost access to their mailbox entirely, which is the one case self-serve reset can never solve.

**Also add a second admin.** Right now Andre is the only one, so if he's unreachable nobody can be let back in. That's a bigger single point of failure than the email pipeline, and it costs one click.
