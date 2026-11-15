/** Every document path starts from a circle id, so no read can cross circles by accident. */
export const paths = {
  circles: 'circles',
  circle: (circleId: string) => `circles/${circleId}`,
  members: (circleId: string) => `circles/${circleId}/members`,
  member: (circleId: string, memberId: string) => `circles/${circleId}/members/${memberId}`,
  medications: (circleId: string) => `circles/${circleId}/medications`,
  medication: (circleId: string, medId: string) => `circles/${circleId}/medications/${medId}`,
  doses: (circleId: string) => `circles/${circleId}/doseEvents`,
  dose: (circleId: string, doseId: string) => `circles/${circleId}/doseEvents/${doseId}`,
  appointments: (circleId: string) => `circles/${circleId}/appointments`,
  appointment: (circleId: string, appointmentId: string) => `circles/${circleId}/appointments/${appointmentId}`,
  activity: (circleId: string) => `circles/${circleId}/activity`,
  activityItem: (circleId: string, activityId: string) => `circles/${circleId}/activity/${activityId}`,
  usedToken: (jti: string) => `usedTokens/${jti}`,
} as const;

/** Collection ids used in collection-group queries; each needs an index in firestore.indexes.json. */
export const groups = { doses: 'doseEvents', appointments: 'appointments', medications: 'medications' } as const;

/** The circle a document path belongs to. */
export function circleIdOf(path: string): string {
  return path.split('/')[1];
}
