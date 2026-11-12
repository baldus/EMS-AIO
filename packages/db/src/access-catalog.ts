import { PERMISSION_DEFINITIONS, SYSTEM_ROLE_LIST } from "@ems/domain";
import type { PrismaClient } from "@prisma/client";

/**
 * Idempotently synchronizes the permission catalog and system roles from @ems/domain into the
 * database. System role permission sets are made to match the catalog exactly.
 */
export async function syncAccessCatalog(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const def of Object.values(PERMISSION_DEFINITIONS)) {
      await tx.permission.upsert({
        where: { key: def.key },
        create: { key: def.key, description: def.description, privileged: def.privileged },
        update: { description: def.description, privileged: def.privileged },
      });
    }
    const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

    for (const r of SYSTEM_ROLE_LIST) {
      const role = await tx.role.upsert({
        where: { key: r.key },
        create: {
          key: r.key,
          name: r.name,
          description: r.description,
          scope: r.scope,
          assignableTo: [...r.assignableTo],
          mfaRequired: r.mfaRequired,
          isSystem: true,
        },
        update: {
          name: r.name,
          description: r.description,
          scope: r.scope,
          assignableTo: [...r.assignableTo],
          mfaRequired: r.mfaRequired,
          isSystem: true,
        },
      });
      const wanted = r.permissions.map((key) => {
        const id = permissionIdByKey.get(key);
        if (!id) throw new Error(`Permission ${key} missing from catalog`);
        return id;
      });
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: wanted } },
      });
      await tx.rolePermission.createMany({
        data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  });
}
