import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { DropResult } from '../types/react-beautiful-dnd-fix';
import { Button } from './ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface Episode {
  id: string | number;
  title: string;
  scheduled_time?: string;
  end_time?: string;
  video_url?: string;
  is_active?: boolean;
  [key: string]: any;
}

interface EpisodeDragDropListProps {
  episodes: Episode[];
  onReorder: (result: DropResult) => void;
  onEdit: (ep: Episode) => void;
  onToggleActive: (ep: Episode) => void;
  onPreview?: (ep: Episode) => void;
  selectedIds: (string | number)[];
  onSelect: (id: string | number) => void;
}

export default function EpisodeDragDropList({ episodes, onReorder, onEdit, onToggleActive, onPreview, selectedIds, onSelect }: EpisodeDragDropListProps) {
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
                    className={`flex items-center justify-between rounded p-2 ${ep.is_active === false ? 'bg-gray-100/60 opacity-70 dark:bg-gray-800/60' : 'bg-gray-100 dark:bg-gray-800'}`}
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedIds.includes(ep.id)} onChange={() => onSelect(ep.id)} />
                      <div>
                        <div className="font-medium">
                          {episodes.length === 1 && !/episode\s+\d+/i.test(ep.title)
                            ? `${ep.title} - Episode 1`
                            : ep.title}
                        </div>
                        <div className="text-xs text-gray-500">{ep.scheduled_time} - {ep.end_time}</div>
                        {ep.is_active === false && <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">Unpublished</div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onEdit(ep)}>Edit</Button>
                      {ep.video_url && onPreview && (
                        <Button type="button" size="sm" variant="outline" onClick={() => onPreview(ep)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Preview
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={ep.is_active === false ? 'outline' : 'destructive'}
                        onClick={() => onToggleActive(ep)}
                      >
                        {ep.is_active === false ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
                        {ep.is_active === false ? 'Publish' : 'Unpublish'}
                      </Button>
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
