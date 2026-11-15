import { DoseSlotCard } from '@/components/DoseSlotCard';

/** Two real slot cards, offset like papers on a table, so the first screen shows the product itself. */
export function TodayPreview() {
  return (
    <div className="today relative mx-auto max-w-3xl">
      <p className="sr-only">
        Example of the Today page: three medicines at 8:00 am marked as taken, and one due at 8:00 pm.
      </p>
      <div aria-hidden>
        <div className="rise rise-3">
          <DoseSlotCard
            slotTime="8:00 am"
            doses={[
              { id: 'a', medName: 'Metformin', strength: '1000 mg', view: 'taken' },
              { id: 'b', medName: 'Amlodipine', strength: '5 mg', view: 'taken' },
              { id: 'c', medName: 'Aspirin', strength: '75 mg', view: 'taken' },
            ]}
          />
        </div>
        <div className="rise rise-4 -mt-4 ml-6 sm:ml-16">
          <DoseSlotCard
            slotTime="8:00 pm"
            doses={[{ id: 'd', medName: 'Atorvastatin', strength: '10 mg', view: 'upcoming' }]}
          />
        </div>
      </div>
    </div>
  );
}
