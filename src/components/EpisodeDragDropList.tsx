import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { DropResult } from '../types/react-beautiful-dnd-fix';
import { Button } from './ui/button';

interface Episode {
  id: string | number;
  title: string;
  scheduled_time?: string;
  end_time?: string;
  video_url?: string;
  [key: string]: any;
}

interface EpisodeDragDropListProps {
  episodes: Episode[];
  onReorder: (result: DropResult) => void;
  onEdit: (ep: Episode) => void;
  onDelete: (id: string | number) => void;
  selectedIds: (string | number)[];
  onSelect: (id: string | number) => void;
}

export default function EpisodeDragDropList({ episodes, onReorder, onEdit, onDelete, selectedIds, onSelect }: EpisodeDragDropListProps) {
  return (
    <DragDropContext onDragEnd={onReorder}>
      <Droppable droppableId="episodes-list">
        {(provided: any) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 max-h-64 overflow-y-auto">
            {episodes.map((ep, idx) => (
              <Draggable key={ep.id} draggableId={String(ep.id)} index={idx}>
                {(provided: any) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded p-2"
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedIds.includes(ep.id)} onChange={() => onSelect(ep.id)} />
                      <div>
                        <div className="font-medium">{ep.title}</div>
                        <div className="text-xs text-gray-500">{ep.scheduled_time} - {ep.end_time}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEdit(ep)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(ep.id)}>Delete</Button>
                      {ep.video_url && <a href={ep.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs px-2 py-1">Watch</a>}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
