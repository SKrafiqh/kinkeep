import { AppointmentForm } from '@/components/AppointmentForm';
import { requireMember } from '@/server/page';

export const metadata = { title: 'Add an appointment' };

export default async function NewAppointmentPage() {
  await requireMember('appointment:write');
  return (
    <div className="grid max-w-2xl gap-6">
      <h1>Add an appointment</h1>
      <AppointmentForm />
    </div>
  );
}
