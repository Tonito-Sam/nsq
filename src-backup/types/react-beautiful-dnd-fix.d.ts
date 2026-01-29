// Minimal type declarations for react-beautiful-dnd for DropResult
export interface DropResult {
  draggableId: string;
  type: string;
  source: {
    index: number;
    droppableId: string;
  };
  destination?: {
    index: number;
    droppableId: string;
  };
  reason: 'DROP' | 'CANCEL';
  mode: 'FLUID' | 'SNAP';
  combine?: any;
}
