import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append an audit log entry. Used for admin actions and expensive AI/search
 * runs. Writes via the service role so audit rows cannot be tampered with by
 * normal RLS-bound clients.
 */
export async function audit(params: {
  actorId: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}
