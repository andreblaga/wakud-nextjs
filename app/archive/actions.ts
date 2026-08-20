"use server";

import { revalidatePath } from "next/cache";
import {
  ARCHIVABLE,
  isArchivableEntity,
  setArchived,
  type ArchivableEntity,
} from "@/lib/archive";
import { requireWriter, type FormState } from "@/lib/form-actions";

/**
 * Archive or unarchive one record.
 *
 * Bound per record on the server (`toggleArchive.bind(null, "deal", id, true)`)
 * and handed to the ArchiveButton, the same way the edit forms receive their
 * update action. The entity is re-validated here rather than trusted: bound
 * arguments travel to the browser and back, so the allowlist has to be applied
 * on this side of the wire, not only where the button was rendered.
 *
 * Deliberately does not redirect. Archiving from a detail page leaves you on
 * that page with the archived banner showing, so a mistake is one click from
 * being undone.
 */
export async function toggleArchive(
  entity: ArchivableEntity,
  id: string,
  archive: boolean,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  if (!isArchivableEntity(entity) || !id) {
    return { ok: false, formError: "That record can't be archived." };
  }

  const config = ARCHIVABLE[entity];
  const gate = await requireWriter(config.domain);
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const result = await setArchived(writer.supabase, {
    entity,
    id,
    userId: writer.userId,
    archive,
  });
  if (!result.ok) return { ok: false, formError: result.message };

  revalidatePath(config.listPath);
  if (config.detailBase) revalidatePath(`${config.detailBase}/${id}`);
  for (const path of config.alsoRevalidate) revalidatePath(path);
  // The Change Log gained a row either way.
  revalidatePath("/change-log");

  return { ok: true };
}
