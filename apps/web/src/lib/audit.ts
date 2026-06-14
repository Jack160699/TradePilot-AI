import { prisma } from '@tradepilot/db';
import type { AuditAction, Prisma } from '@tradepilot/db';

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit logging. Never throws into the caller's path. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', err);
  }
}
