import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Names for user ids, so a feedback item can say who raised it.
 *
 * Emails live in auth.users, which no ordinary client can read, and neither
 * `feedback` nor `feedback_comments` denormalises the author's email the way
 * `messages` does. Resolving them therefore needs the service-role client.
 *
 * That is a deliberate, narrow use: it exposes nothing beyond the display name
 * of a colleague inside an eight-person company, on a page where everyone
 * already sees everyone's submissions (the agreed model), and Discussions
 * already shows author emails to every signed-in user. The key is optional —
 * without SUPABASE_SERVICE_ROLE_KEY set, the directory falls back to a short
 * id rather than failing the page.
 */

/** Display name for one user id, plus whether it is the viewer themselves. */
export type UserDirectory = {
  /** "andre" for andre@…, or "#a1b2c3d4" when the directory is unavailable. */
  nameFor: (userId: string | null | undefined) => string;
};

const shortId = (userId: string) => `#${userId.slice(0, 8)}`;

/** "andre.blaga@wakud.com" → "andre.blaga". */
function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  return local || null;
}

/**
 * Build a directory for the current request.
 *
 * One listUsers() call per render rather than a lookup per row. The team is
 * eight people; perPage 200 covers it many times over, and anyone beyond that
 * page simply falls back to a short id rather than silently showing the wrong
 * name.
 */
export async function getUserDirectory(viewerId?: string | null): Promise<UserDirectory> {
  const service = createAdminClient();
  const byId = new Map<string, string>();

  if (service) {
    const { data } = await service.auth.admin.listUsers({ perPage: 200 });
    for (const user of data?.users ?? []) {
      const name = nameFromEmail(user.email);
      if (name) byId.set(user.id, name);
    }
  }

  return {
    nameFor(userId) {
      if (!userId) return "Someone";
      if (userId === viewerId) return "You";
      return byId.get(userId) ?? shortId(userId);
    },
  };
}
