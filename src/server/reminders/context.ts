import type { Circle, Member } from '@/domain/types';

/** A circle and its current members, read once per tick and shared by every stage. */
export interface CircleContext {
  circle: Circle;
  members: Member[];
}
