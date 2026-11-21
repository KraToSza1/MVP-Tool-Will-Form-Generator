import React, { useMemo } from 'react';
import WeekSchedule from '../components/solicitor/WeekSchedule.jsx';
import { nextWorkingDays } from '../lib/weekScheduleLayout.js';

/** Dev-only preview of the solicitor schedule with sample Microsoft calendar items (route: /dev/week-schedule). */
export default function WeekScheduleDemoPage() {
  const days = useMemo(() => nextWorkingDays(new Date(), 5), []);
  const items = useMemo(() => {
    const at = (d, h, m = 0) => { const x = new Date(days[d]); x.setHours(h, m, 0, 0); return x; };
    const nextDay = (d) => { const x = new Date(days[d]); x.setDate(x.getDate() + 1); x.setHours(0, 0, 0, 0); return x; };
    const ev = (subject, s, e, status = 'busy') => ({ subject, status, startDate: s, endDate: e });
    return [
      ev('Small 01643 – chase Emma Tomlinson', at(0, 11, 30), at(0, 12, 30)),
      ev('Follow up: Patrick – signed IHT form', at(0, 12), at(0, 13)),
      ev('Pascall 01017 – Colleen to call re estate', at(0, 13), at(0, 13, 30)),
      ev("Aristone Solicitors' Zoom Meeting", at(0, 14), at(0, 15)),
      ev('Coghlan / Azevedo 01740 – executors', at(0, 15), at(0, 15, 45), 'tentative'),
      ev('Billing deadline', at(1, 0), nextDay(1), 'free'),
      ev('Follow up: Patrick – 02013 client docs', at(1, 12), at(1, 12, 30)),
      ev('LPA Signing Andy Coghlan and Tracey', at(1, 14), at(1, 15)),
      ev('C-O TRANSFERS DEADLINE', at(2, 2), at(2, 2), 'busy'),
      ev('Follow up: Patrick – Rushan & co', at(2, 11, 45), at(2, 12, 15)),
      ev('Small 01643 – weekly update to client', at(2, 12), at(2, 12, 45)),
      ev('Lit closing files review', at(2, 13), at(2, 14)),
      ev('Annual leave', at(4, 0), nextDay(4), 'oof'),
      ev('Follow up: Marvon – lease', at(0, 11, 30), at(0, 11, 45)),
      ev('Follow up: Avah – Grant', at(0, 11, 30), at(0, 11, 45)),
      ev('Marshall 01723 – call', at(0, 11, 45), at(0, 12)),
      ev('Small 01643 – deeds', at(0, 11, 45), at(0, 12, 15)),
      ev('Follow up: Mr Bah decision deadline', at(0, 18), at(0, 18, 15)),
      ev('Pascall 01017 – check Marvon has', at(0, 18), at(0, 18, 15)),
      ev('Billing to be complete – Confirm', at(0, 18), at(0, 18, 15)),
      ev('Follow up Florrie – Ashraf 01418', at(0, 19), at(0, 19, 15)),
    ];
  }, [days]);
  return (
    <div className="min-h-dvh bg-slate-950 p-4 sm:p-8">
      <WeekSchedule days={days} items={items} rules={{ start_time: '09:00', end_time: '17:00', slot_minutes: 30, timezone: 'Europe/London' }} onEditAvailability={() => {}} />
    </div>
  );
}
