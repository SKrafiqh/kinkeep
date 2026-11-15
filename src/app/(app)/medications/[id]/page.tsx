import { notFound } from 'next/navigation';
import { DeleteButton } from '@/components/DeleteButton';
import { MedicationForm } from '@/components/MedicationForm';
import { localDate } from '@/domain/time';
import type { Medication } from '@/domain/types';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { paths } from '@/server/repos/paths';

export const metadata = { title: 'Edit medicine' };

export default async function EditMedicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { circle } = await requireMember('medication:write');
  const { id } = await params;
  const deps = getDeps();
  const medication = await deps.store.get<Medication>(paths.medication(circle.id, id));
  if (!medication) notFound();

  return (
    <div className="grid max-w-2xl gap-6">
      <h1>
        Edit {medication.name}
        {medication.active ? '' : ' (paused)'}
      </h1>
      <p className="text-muted">Changes apply from the next dose. Doses already taken or missed stay as they were.</p>
      <MedicationForm medication={medication} today={localDate(deps.clock.now(), circle.timeZone)} />
      <DeleteButton
        path={`/api/medications/${medication.id}`}
        label="Delete this medicine"
        title={`Delete ${medication.name}?`}
        consequence="Its reminders stop and its future doses are removed. The record of doses already taken or missed is kept."
        done={`${medication.name} was deleted.`}
        redirectTo="/medications"
      />
    </div>
  );
}
