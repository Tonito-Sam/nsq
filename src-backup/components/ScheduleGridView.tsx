import React from 'react';

export type ProgramSchedule = {
  id: number;
  title: string;
  description?: string;
  category?: string;
  time_slot_start: string; // "HH:MM"
  time_slot_end: string;   // "HH:MM"
  days_of_week?: string[];
  is_live?: boolean;
  is_rerun?: boolean;
  color_code?: string;
  show_id?: number;
};

const ScheduleGridView: React.FC<{ schedule: ProgramSchedule[]; date: Date; onDateChange: (d: Date) => void }> = ({ schedule }) => {
  const timeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="flex border-b">
          <div className="w-24"></div>
          {timeSlots.map(time => (
            <div key={time} className="flex-1 text-center text-sm py-2 border-r">{time}</div>
          ))}
        </div>
        <div className="relative h-[260px]">
          {schedule.map((program, idx) => {
            const [sh, sm] = program.time_slot_start.split(':').map(Number);
            const [eh, em] = program.time_slot_end.split(':').map(Number);
            const start = sh + (sm || 0) / 60;
            let end = eh + (em || 0) / 60;
            if (end <= start) end = start + 0.5; // ensure visible
            const left = (start / 24) * 100;
            const width = ((end - start) / 24) * 100;
            return (
              <div
                key={program.id + '-' + idx}
                className={`absolute h-16 rounded-lg p-2 border-l-4 ${program.color_code || 'bg-gray-100 border-gray-400'} shadow-sm`}
                style={{ left: `${left}%`, width: `${width}%`, top: `${10 + idx * 56}px` }}
              >
                  <div className="font-semibold text-sm text-gray-900">{program.title}</div>
                  <div className="text-xs text-gray-700 opacity-90">{program.time_slot_start} - {program.time_slot_end}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScheduleGridView;
