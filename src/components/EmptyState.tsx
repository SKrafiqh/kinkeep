import Link from 'next/link';

interface Props {
  title: string;
  /** What will appear here once there is something to show. */
  children: string;
  action?: { href: string; label: string };
}

/** Says what belongs on an empty list and offers the first step. */
export function EmptyState({ title, children, action }: Props) {
  return (
    <div className="card rise grid justify-items-start gap-3">
      <h2>{title}</h2>
      <p className="max-w-prose text-muted">{children}</p>
      {action ? (
        <Link href={action.href} className="btn btn-primary">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
