import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <PublicShell>
      <div className="grid justify-items-start gap-4">
        <h1>We could not find that page</h1>
        <p>It may have been removed, or the link may be mistyped.</p>
        <Link href="/" className="btn btn-primary">
          Go to the start
        </Link>
      </div>
    </PublicShell>
  );
}
