/** Placeholder with the same shape as a page: a heading and two cards. */
export default function Loading() {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton h-40" />
      <div className="skeleton h-40" />
    </div>
  );
}
