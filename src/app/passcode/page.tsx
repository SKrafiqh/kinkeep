import { redirect } from 'next/navigation';
import { PasscodeChangeForm } from '@/components/PasscodeChangeForm';
import { PublicShell } from '@/components/PublicShell';
import { currentMember } from '@/server/page';

export const metadata = { title: 'Choose your passcode' };

export default async function PasscodePage() {
  const who = await currentMember();
  if (!who) redirect('/join');
  const isSetup = who.member.mustChangePasscode;
  return (
    <PublicShell>
      <div className="grid gap-6">
        <h1>{isSetup ? `Welcome, ${who.member.name}. Choose your own passcode` : 'Change your passcode'}</h1>
        {isSetup ? <p>The passcode you were given works once. Pick a new one that only you know, and you are in.</p> : null}
        <PasscodeChangeForm isSetup={isSetup} />
      </div>
    </PublicShell>
  );
}
