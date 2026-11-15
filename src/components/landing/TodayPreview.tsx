import { DoseSlotCard } from '@/components/DoseSlotCard';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@/components/icons';

/**
 * The product itself, floating: a real Today slot, the reminder email that came before it,
 * and the note that nobody else was told. Decorative duplication, so screen readers get one sentence.
 */
export function TodayPreview() {
  return (
    <div className="float-stage rise rise-3">
      <p className="sr-only">
        Example: an 8:00 am reminder email listing three medicines with an I took them button, the Today page showing
        all three marked as taken, and a note that nobody else was emailed.
      </p>
      <div aria-hidden>
        <div className="float-mail glass float-lift">
          <p className="flex items-center gap-2 font-semibold">
            <EnvelopeSimpleIcon weight="duotone" size={24} className="shrink-0 text-primary" />
            Your 8:00 am medicines (3)
          </p>
          <p className="text-[0.889rem] text-muted">Metformin, Amlodipine, Aspirin</p>
          <span className="btn btn-primary pointer-events-none min-h-11 justify-self-start px-5 text-[0.889rem]">
            I took them
          </span>
        </div>
        <div className="float-slot">
          <DoseSlotCard
            slotTime="8:00 am"
            doses={[
              { id: 'a', medName: 'Metformin', strength: '1000 mg', view: 'taken' },
              { id: 'b', medName: 'Amlodipine', strength: '5 mg', view: 'taken' },
              { id: 'c', medName: 'Aspirin', strength: '75 mg', view: 'taken' },
            ]}
          />
        </div>
        <p className="float-chip glass float-lift">
          <CheckCircleIcon weight="fill" size={24} className="shrink-0 text-taken" />
          Taken at 8:02 am · nobody else was emailed
        </p>
      </div>
    </div>
  );
}
