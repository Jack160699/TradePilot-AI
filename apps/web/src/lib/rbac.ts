import { prisma } from '@tradepilot/db';
import { cached } from './redis';

/** Resolve the flattened permission set for a user (5 min cache). */
export async function getUserPermissions(userId: string): Promise<string[]> {
  return cached(`rbac:perms:${userId}`, 300, async () => {
    const roles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const set = new Set<string>();
    for (const ur of roles) {
      for (const rp of ur.role.permissions) set.add(rp.permission.key);
    }
    return [...set];
  });
}

export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(key) || perms.includes('admin:access');
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return roles.map((r) => r.role.name);
}

export class ForbiddenError extends Error {
  constructor(key: string) {
    super(`Missing required permission: ${key}`);
    this.name = 'ForbiddenError';
  }
}

/** Guard used in server actions / route handlers. Throws on denial. */
export async function requirePermission(userId: string, key: string): Promise<void> {
  if (!(await hasPermission(userId, key))) throw new ForbiddenError(key);
}
