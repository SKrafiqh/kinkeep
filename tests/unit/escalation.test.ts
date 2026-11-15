import { describe, expect, it } from 'vitest';
import { advanceDose, applyDoseAction, doseView, isOpen } from '@/domain/escalation';
import { MINUTE_MS, REMINDER_DEFAULTS } from '@/lib/constants';

const DUE = Date.UTC(2026, 10, 16, 2, 30);
const at = (minutes: number): number => DUE + minutes * MINUTE_MS;

describe('advanceDose', () => {
  it('does nothing before the first look', () => {
    expect(
      advanceDose({ status: 'scheduled', dueAt: DUE, nextActionAt: at(-15) }, at(-16), REMINDER_DEFAULTS),
    ).toBeNull();
  });

  it('walks scheduled → reminded → nudged → missed on time', () => {
    expect(advanceDose({ status: 'scheduled', dueAt: DUE, nextActionAt: at(-15) }, at(-15), REMINDER_DEFAULTS)).toEqual(
      {
        status: 'reminded',
        nextActionAt: at(30),
        notify: true,
      },
    );
    expect(advanceDose({ status: 'reminded', dueAt: DUE, nextActionAt: at(30) }, at(30), REMINDER_DEFAULTS)).toEqual({
      status: 'nudged',
      nextActionAt: at(60),
      notify: true,
    });
    expect(advanceDose({ status: 'nudged', dueAt: DUE, nextActionAt: at(60) }, at(60), REMINDER_DEFAULTS)).toEqual({
      status: 'missed',
      nextActionAt: null,
      notify: true,
    });
  });

  it('jumps straight to the right stage when a tick is late', () => {
    const scheduled = { status: 'scheduled', dueAt: DUE, nextActionAt: at(-15) } as const;
    expect(advanceDose(scheduled, at(31), REMINDER_DEFAULTS)?.status).toBe('nudged');
    expect(advanceDose(scheduled, at(61), REMINDER_DEFAULTS)).toEqual({
      status: 'missed',
      nextActionAt: null,
      notify: true,
    });
  });

  it('reschedules without notifying when the stage has not moved', () => {
    expect(advanceDose({ status: 'reminded', dueAt: DUE, nextActionAt: at(5) }, at(5), REMINDER_DEFAULTS)).toEqual({
      status: 'reminded',
      nextActionAt: at(30),
      notify: false,
    });
  });

  it('ignores settled doses and doses with no pending look', () => {
    expect(advanceDose({ status: 'taken', dueAt: DUE, nextActionAt: null }, at(90), REMINDER_DEFAULTS)).toBeNull();
    expect(advanceDose({ status: 'missed', dueAt: DUE, nextActionAt: at(60) }, at(90), REMINDER_DEFAULTS)).toBeNull();
    expect(advanceDose({ status: 'reminded', dueAt: DUE, nextActionAt: null }, at(90), REMINDER_DEFAULTS)).toBeNull();
  });
});

describe('applyDoseAction', () => {
  it('settles any open dose', () => {
    for (const status of ['scheduled', 'reminded', 'nudged'] as const) {
      expect(applyDoseAction(status, 'taken')).toEqual({ status: 'taken', late: false });
      expect(applyDoseAction(status, 'skipped')).toEqual({ status: 'skipped', late: false });
    }
  });

  it('records a dose taken after it was missed as late', () => {
    expect(applyDoseAction('missed', 'taken')).toEqual({ status: 'taken', late: true });
  });

  it('refuses to change a settled dose or skip a missed one', () => {
    expect(applyDoseAction('missed', 'skipped')).toBeNull();
    expect(applyDoseAction('taken', 'skipped')).toBeNull();
    expect(applyDoseAction('skipped', 'taken')).toBeNull();
  });
});

describe('doseView', () => {
  it('describes each state in screen terms', () => {
    expect(doseView({ status: 'scheduled', dueAt: DUE, late: false }, at(-60))).toBe('upcoming');
    expect(doseView({ status: 'reminded', dueAt: DUE, late: false }, at(-10))).toBe('due');
    expect(doseView({ status: 'reminded', dueAt: DUE, late: false }, at(2))).toBe('due');
    expect(doseView({ status: 'reminded', dueAt: DUE, late: false }, at(20))).toBe('late');
    expect(doseView({ status: 'missed', dueAt: DUE, late: false }, at(90))).toBe('missed');
    expect(doseView({ status: 'taken', dueAt: DUE, late: false }, at(1))).toBe('taken');
    expect(doseView({ status: 'taken', dueAt: DUE, late: true }, at(90))).toBe('taken-late');
    expect(doseView({ status: 'skipped', dueAt: DUE, late: false }, at(1))).toBe('skipped');
  });

  it('knows which statuses are open', () => {
    expect(['scheduled', 'reminded', 'nudged', 'missed', 'taken', 'skipped'].filter((s) => isOpen(s as never))).toEqual(
      ['scheduled', 'reminded', 'nudged'],
    );
  });
});
