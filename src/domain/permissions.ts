import type { Role } from './types';

export type Permission = 'circle:view' | 'dose:act' | 'medication:write' | 'appointment:write' | 'members:manage';

export const ROLES: readonly Role[] = ['elder', 'caregiver', 'family'];
export const PERMISSIONS: readonly Permission[] = [
  'circle:view',
  'dose:act',
  'medication:write',
  'appointment:write',
  'members:manage',
];

// The whole access model. The elder owns the circle; family only looks.
const TABLE: Record<Role, readonly Permission[]> = {
  elder: PERMISSIONS,
  caregiver: ['circle:view', 'dose:act', 'medication:write', 'appointment:write'],
  family: ['circle:view'],
};

/** True when `role` is allowed to do `permission`. */
export function can(role: Role, permission: Permission): boolean {
  return TABLE[role].includes(permission);
}

/** Where a member lands after signing in. */
export function homePath(role: Role): '/today' | '/circle' {
  return role === 'elder' ? '/today' : '/circle';
}
