import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JoinForm } from '@/components/JoinForm';
import { PublicShell } from '@/components/PublicShell';
import { homePath } from '@/domain/permissions';
import { currentMember } from '@/server/page';

export const metadata = { title: 'Join a circle' };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const who = await currentMember();
  if (who) redirect(who.member.mustChangePasscode ? '/passcode' : homePath(who.member.role));
  const { code } = await searchParams;
  return (
    <PublicShell>
      <div className="grid gap-6">
        <h1>Join a circle</h1>
        <JoinForm initialCode={typeof code === 'string' ? code.slice(0, 6) : ''} />
        <p>
          No circle yet?{' '}
          <Link href="/create" className="link">
            Create a circle
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
