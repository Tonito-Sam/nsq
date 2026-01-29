import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface EpisodeCalendarProps {
  episodes: any[];
  onEventDrop: (info: any) => void;
  onEventClick: (info: any) => void;
}

export default function EpisodeCalendar({ episodes, onEventDrop, onEventClick }: EpisodeCalendarProps) {
  // Map episodes to calendar events
  const events = episodes.map((ep: any) => ({
    id: String(ep.id),
    title: ep.title,
    start: ep.scheduled_time,
    end: ep.end_time,
    backgroundColor: ep.is_active ? '#7c3aed' : '#d1d5db',
    borderColor: ep.is_active ? '#7c3aed' : '#d1d5db',
    extendedProps: { episode: ep }
  }));

  return (
    <div className="fc-compact">
      <style>{`
        .fc-compact .fc { font-size: 12px; }
        .fc-compact .fc-toolbar { padding: 6px 8px; }
        .fc-compact .fc .fc-timegrid-axis-cushion { font-size: 11px; }
        .fc-compact .fc .fc-timegrid-event { padding: 2px 4px; font-size: 11px; }
        .fc-compact .fc .fc-daygrid-day-top { padding: 2px 4px; }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
        events={events}
        editable={true}
        droppable={false}
        eventDrop={onEventDrop}
        eventClick={onEventClick}
        height={420}
      />
    </div>
  );
}
