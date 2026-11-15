import { describe, expect, it } from 'vitest';
import { maskEmail } from '@/lib/logger';
import { escapeHtml, renderEmail } from '@/server/email/layout';
import {
  appointmentEmail,
  missedEmail,
  nudgeEmail,
  sampleEmail,
  upcomingEmail,
  weeklySummaryEmail,
  type SlotEmail,
} from '@/server/email/templates';

describe('escapeHtml and renderEmail', () => {
  it('escapes the five special characters and leaves other text alone', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('Plain 😀 text, ünïcode')).toBe('Plain 😀 text, ünïcode');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes every field in the html part and keeps the text part readable', () => {
    const rendered = renderEmail({
      heading: '<h1>Head</h1>',
      lines: ['Line <b>one</b>'],
      items: ['<script>alert(1)</script>'],
      primary: { label: 'Go <now>', url: 'https://x.example/?a=1&b="2"' },
      secondary: { label: 'Skip', url: 'https://x.example/?do=skip' },
      footer: 'Foot <i>er</i>',
    });
    expect(rendered.html).not.toMatch(/<script|<b>|<i>|<now>/);
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).toContain('href="https://x.example/?a=1&amp;b=&quot;2&quot;"');
    expect(rendered.text).toContain('- <script>alert(1)</script>');
    expect(rendered.text).toContain('Go <now>: https://x.example/?a=1&b="2"');
    expect(rendered.text).toContain('Skip: https://x.example/?do=skip');
    expect(rendered.text.endsWith('Foot <i>er</i>')).toBe(true);
  });

  it('adds the default footer and omits the empty parts', () => {
    const rendered = renderEmail({ heading: 'Hi', lines: ['Body'] });
    expect(rendered.text).toBe('Hi\n\nBody\n\nYou are getting this because you are part of a KinKeep care circle.');
    expect(rendered.html).not.toContain('<ul');
    expect(rendered.html).not.toContain('<a ');
    expect(renderEmail({ heading: 'Hi', lines: [], items: [] }).html).not.toContain('<ul');
  });
});

describe('email templates', () => {
  const slot: SlotEmail = {
    whose: 'Your',
    slotTime: '9:00 am',
    medicines: [
      { name: '<script>alert("x")</script>', strength: '500 mg' },
      { name: 'Aspirin', strength: '' },
    ],
    actUrl: 'https://kinkeep.example/act/token',
  };
  const medicines = slot.medicines;

  const all = {
    upcoming: upcomingEmail(slot),
    upcomingWithNote: upcomingEmail(slot, 'A <note>'),
    nudge: nudgeEmail(slot),
    missed: missedEmail({
      elderName: 'Mr Rao',
      slotTime: '9:00 am',
      medicines,
      circleUrl: 'https://kinkeep.example/circle',
    }),
    appointment: appointmentEmail({
      kind: 'h24',
      whose: "Mr Rao's",
      doctor: 'Dr <Mehta>',
      speciality: '',
      place: 'Clinic',
      when: 'Thu 19 Nov 10:30 am',
      briefUrl: 'https://kinkeep.example/b',
    }),
    appointmentSoon: appointmentEmail({
      kind: 'h2',
      whose: 'Your',
      doctor: 'Dr Mehta',
      speciality: 'Cardiology',
      place: '',
      when: 'today',
      briefUrl: 'https://kinkeep.example/b',
    }),
    weekly: weeklySummaryEmail({
      elderName: 'Mr Rao',
      sentences: ['He took <most> doses.'],
      circleUrl: 'https://kinkeep.example/circle',
    }),
    sample: sampleEmail('https://kinkeep.example/today'),
  };

  it.each(Object.entries(all))('%s has a subject, a text part and an html part', (_name, email) => {
    expect(email.subject.trim()).not.toBe('');
    expect(email.text.trim()).not.toBe('');
    expect(email.html).toContain('<!doctype html>');
    expect(email.subject).not.toContain('undefined');
    expect(email.text).not.toContain('undefined');
  });

  it('escapes user-entered medicine names in the html part of every medicine email', () => {
    for (const email of [all.upcoming, all.nudge, all.missed]) {
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; 500 mg');
      expect(email.text).toContain('- <script>alert("x")</script> 500 mg');
      expect(email.text).toContain('- Aspirin');
    }
  });

  it('escapes other user-entered text, such as doctor names, notes and sentences', () => {
    expect(all.appointment.html).not.toContain('<Mehta>');
    expect(all.appointment.html).toContain('Dr &lt;Mehta&gt;');
    expect(all.upcomingWithNote.html).toContain('A &lt;note&gt;');
    expect(all.weekly.html).toContain('He took &lt;most&gt; doses.');
  });

  it('puts the confirm and skip links in the dose emails', () => {
    for (const email of [all.upcoming, all.nudge]) {
      expect(email.text).toContain('I took them: https://kinkeep.example/act/token');
      expect(email.text).toContain('Skip this dose: https://kinkeep.example/act/token?do=skip');
    }
    expect(all.missed.text).not.toContain('/act/');
    expect(all.sample.text).not.toContain('/act/');
  });

  it('counts the medicines in the upcoming subject and picks the subject by kind', () => {
    expect(all.upcoming.subject).toBe('Your 9:00 am medicines (2)');
    expect(all.appointment.subject).toBe('Coming up: Dr <Mehta>, Thu 19 Nov 10:30 am');
    expect(all.appointmentSoon.subject).toBe('Soon: Dr Mehta, today');
    expect(all.appointmentSoon.text).toContain('Cardiology');
    expect(all.appointment.text).not.toContain(' · ');
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('priya@example.com')).toBe('p***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });

  it('copes with odd input without throwing', () => {
    expect(maskEmail('')).toBe('***@');
    expect(maskEmail('no-at-sign')).toBe('n***@');
    expect(maskEmail('🙂x@example.com').endsWith('***@example.com')).toBe(true);
  });

  it('never contains the rest of the local part', () => {
    expect(maskEmail('secretname@example.com')).not.toContain('ecret');
  });
});
