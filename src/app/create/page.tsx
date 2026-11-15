import Link from 'next/link';
import { CreateCircleForm } from '@/components/CreateCircleForm';
import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Create a circle' };

export default function CreatePage() {
  return (
    <PublicShell>
      <div className="grid gap-6">
        <h1>Create a care circle</h1>
        <p>
          A circle is for one person receiving care. If you are setting it up for them, they still get their own
          passcode and the final say.
        </p>
        <CreateCircleForm timeZones={Intl.supportedValuesOf('timeZone')} />
        <p>
          Already have a circle code?{' '}
          <Link href="/join" className="link">
            Join a circle
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
