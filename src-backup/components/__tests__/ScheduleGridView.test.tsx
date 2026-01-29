import React from 'react';
import { render, screen } from '@testing-library/react';
import ScheduleGridView, { ProgramSchedule } from '../ScheduleGridView';

describe('ScheduleGridView', () => {
  it('renders program blocks', () => {
    const schedule: ProgramSchedule[] = [
      { id: 1, title: 'Breakfast', time_slot_start: '08:00', time_slot_end: '11:00', color_code: 'bg-blue-100' },
      { id: 2, title: 'Fanalysis', time_slot_start: '11:30', time_slot_end: '12:00', color_code: 'bg-green-100' }
    ];
    render(<ScheduleGridView schedule={schedule} date={new Date()} onDateChange={() => {}} />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Fanalysis')).toBeTruthy();
  });
});
