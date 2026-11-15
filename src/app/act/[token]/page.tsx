import Link from 'next/link';
import { ActForm } from '@/components/ActForm';
import { PublicShell } from '@/components/PublicShell';
import { AppError } from '@/lib/errors';
import { getDeps } from '@/server/deps';
import { previewAction, type ActionPreview } from '@/server/services/actions';

export const metadata = { title: 'Confirm your medicines', robots: { index: false, follow: false } };

async function load(token: string): Promise<ActionPreview | string> {
  try {
    return await previewAction(getDeps(), token);
  } catch (error) {
    if (error instanceof AppError) return error.message;
    throw error;
  }
}

/** Where a one-tap email link lands. Loading this page changes nothing; only the buttons do. */
export default async function ActPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ do?: string }> }) {
  const [{ token }, { do: intent }] = await Promise.all([params, searchParams]);
  const preview = await load(token);

  if (typeof preview === 'string') {
    return (
      <PublicShell>
        <div className="grid justify-items-start gap-4">
          <h1>This link cannot be used</h1>
          <p>{preview}</p>
          <Link href="/join" className="btn btn-primary">
            Sign in to the circle
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="today grid gap-6">
        <h1>{preview.slotTime} medicines</h1>
        <p>
          {preview.day}, for {preview.elderName}
        </p>
        <ul className="margin-rule grid gap-2 pl-4">
          {preview.medicines.map((medicine) => (
            <li key={`${medicine.name} ${medicine.strength}`}>
              <strong>{medicine.name}</strong> {medicine.strength}
            </li>
          ))}
        </ul>
        {preview.settled ? (
          <p className="font-bold">These are already marked. There is nothing more to do.</p>
        ) : (
          <ActForm token={token} preferred={intent === 'skip' ? 'skipped' : 'taken'} />
        )}
      </div>
    </PublicShell>
  );
}
