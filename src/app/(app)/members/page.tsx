import { AddMemberForm } from '@/components/AddMemberForm';
import { MemberRow } from '@/components/MemberRow';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { listMemberViews } from '@/server/services/members';

export const metadata = { title: 'Members' };

/** Elder only: who is in the circle, what each person may do, and what each is told. */
export default async function MembersPage() {
  const { circle } = await requireMember('members:manage');
  const members = await listMemberViews(getDeps(), circle);
  const elderFirst = [...members].sort((a, b) => Number(b.role === 'elder') - Number(a.role === 'elder'));

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1>Members</h1>
        <p>
          You decide who is in your circle, what they can change, and what they are told. The circle code is <strong>{circle.code}</strong>.
        </p>
      </div>
      <ul className="grid gap-4">
        {elderFirst.map((member) => (
          <MemberRow key={member.id} member={member} elderName={circle.elderName} />
        ))}
      </ul>
      <AddMemberForm circleCode={circle.code} />
    </div>
  );
}
