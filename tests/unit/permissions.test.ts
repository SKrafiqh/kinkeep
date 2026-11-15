import { describe, expect, it } from 'vitest';
import { can, homePath, PERMISSIONS, ROLES } from '@/domain/permissions';

// The full matrix, written out so any change to the table has to be made twice on purpose.
const EXPECTED = {
  elder: {
    'circle:view': true,
    'dose:act': true,
    'medication:write': true,
    'appointment:write': true,
    'members:manage': true,
  },
  caregiver: {
    'circle:view': true,
    'dose:act': true,
    'medication:write': true,
    'appointment:write': true,
    'members:manage': false,
  },
  family: {
    'circle:view': true,
    'dose:act': false,
    'medication:write': false,
    'appointment:write': false,
    'members:manage': false,
  },
} as const;

describe('permissions', () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      it(`${role} ${EXPECTED[role][permission] ? 'can' : 'cannot'} ${permission}`, () => {
        expect(can(role, permission)).toBe(EXPECTED[role][permission]);
      });
    }
  }

  it('only the elder manages members', () => {
    expect(ROLES.filter((role) => can(role, 'members:manage'))).toEqual(['elder']);
  });

  it('lands the elder on Today and everyone else on the circle', () => {
    expect(homePath('elder')).toBe('/today');
    expect(homePath('caregiver')).toBe('/circle');
    expect(homePath('family')).toBe('/circle');
  });
});
