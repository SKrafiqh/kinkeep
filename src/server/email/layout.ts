import { APP_NAME } from '@/lib/constants';

export interface EmailLink {
  label: string;
  url: string;
}

export interface EmailParts {
  heading: string;
  lines: string[];
  items?: string[];
  /** The one button. */
  primary?: EmailLink;
  /** A plain text link under the button. */
  secondary?: EmailLink;
  footer?: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes user-entered text safe to place in HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

const FOOTER = `You are getting this because you are part of a ${APP_NAME} care circle.`;
const BODY =
  'margin:0;padding:24px;background:#FBF7F0;color:#16262E;font-family:Verdana,Arial,sans-serif;font-size:18px;line-height:1.6';
const BUTTON =
  'display:inline-block;background:#0F5C5C;color:#FFFFFF;padding:16px 28px;border-radius:12px;font-size:20px;font-weight:700;text-decoration:none';

function html(parts: EmailParts): string {
  const lines = parts.lines.map((line) => `<p style="margin:0 0 16px">${escapeHtml(line)}</p>`).join('');
  const items = parts.items?.length
    ? `<ul style="margin:0 0 20px;padding-left:24px">${parts.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const primary = parts.primary
    ? `<p style="margin:24px 0"><a href="${escapeHtml(parts.primary.url)}" style="${BUTTON}">${escapeHtml(parts.primary.label)}</a></p>`
    : '';
  const secondary = parts.secondary
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(parts.secondary.url)}" style="color:#0F5C5C">${escapeHtml(parts.secondary.label)}</a></p>`
    : '';
  return [
    `<!doctype html><html lang="en"><body style="${BODY}">`,
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #D6CFC2;border-radius:16px;padding:28px">',
    `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.3">${escapeHtml(parts.heading)}</h1>`,
    lines,
    items,
    primary,
    secondary,
    `<p style="margin:24px 0 0;font-size:16px;color:#3F4F56">${escapeHtml(parts.footer ?? FOOTER)}</p>`,
    '</div></body></html>',
  ].join('');
}

function text(parts: EmailParts): string {
  const blocks = [
    parts.heading,
    ...parts.lines,
    ...(parts.items?.length ? [parts.items.map((item) => `- ${item}`).join('\n')] : []),
    ...(parts.primary ? [`${parts.primary.label}: ${parts.primary.url}`] : []),
    ...(parts.secondary ? [`${parts.secondary.label}: ${parts.secondary.url}`] : []),
    parts.footer ?? FOOTER,
  ];
  return blocks.join('\n\n');
}

/** Renders one email as HTML and plain text. Large type, one button, no remote images. */
export function renderEmail(parts: EmailParts): { html: string; text: string } {
  return { html: html(parts), text: text(parts) };
}
