import { MedicationForm } from '@/components/MedicationForm';
import { localDate } from '@/domain/time';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';

export const metadata = { title: 'Add a medicine' };

export default async function NewMedicationPage() {
  const { circle } = await requireMember('medication:write');
  return (
    <div className="grid max-w-2xl gap-6">
      <h1>Add a medicine</h1>
      <MedicationForm today={localDate(getDeps().clock.now(), circle.timeZone)} />
    </div>
  );
}
