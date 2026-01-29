
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, X } from 'lucide-react';

export interface EventItem {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'anniversary';
  relationship?: string;
}

interface BirthdayAnniversaryCardProps {
  events?: EventItem[];
  isAddingEvent?: boolean;
  newEvent?: Omit<EventItem, 'id'>;
  onAddEvent?: () => void;
  onRemoveEvent?: (id: string) => void;
  onNewEventChange?: (field: keyof Omit<EventItem, 'id'>, value: string) => void;
  setIsAddingEvent?: (val: boolean) => void;
}

const relationshipOptions = [
  'Self', 'Spouse/Partner', 'Child', 'Parent', 'Sibling',
  'Friend', 'Extended Family', 'Colleague', 'Other'
];

const BirthdayAnniversaryCard: React.FC<BirthdayAnniversaryCardProps> = ({
  events = [],
  isAddingEvent = false,
  newEvent = { title: '', date: '', type: 'birthday', relationship: '' },
  onAddEvent = () => {},
  onRemoveEvent = () => {},
  onNewEventChange = () => {},
  setIsAddingEvent = () => {},
}) => {
  return (
    <Card className="p-6 dark:bg-[#161616] bg-white border border-gray-200 dark:border-gray-800">
      <div className="flex items-center mb-6">
        <Calendar className="h-5 w-5 mr-3 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Birthdays & Anniversaries
        </h2>
      </div>

      {/* Add Event Form */}
      {isAddingEvent && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="event-type" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Event Type
              </Label>
              <Select
                value={newEvent.type}
                onValueChange={(value: 'birthday' | 'anniversary') => 
                  onNewEventChange('type', value)
                }
              >
                <SelectTrigger className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Birthday" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-600">
                  <SelectItem value="birthday" className="text-white hover:bg-gray-800">Birthday</SelectItem>
                  <SelectItem value="anniversary" className="text-white hover:bg-gray-800">Anniversary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="relationship" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Relationship
              </Label>
              <Select
                value={newEvent.relationship || ''}
                onValueChange={(value) => 
                  onNewEventChange('relationship', value)
                }
              >
                <SelectTrigger className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-600">
                  {relationshipOptions.map((option) => (
                    <SelectItem 
                      key={option} 
                      value={option}
                      className="text-white hover:bg-gray-800"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <Label htmlFor="event-title" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Title/Caption
            </Label>
            <Input
              id="event-title"
              value={newEvent.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewEventChange('title', e.target.value)}
              placeholder="John's Birthday"
              className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="mb-4">
            <Label htmlFor="event-date" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Date
            </Label>
            <Input
              id="event-date"
              type="text"
              value={newEvent.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewEventChange('date', e.target.value)}
              placeholder="yyyy/mm/dd"
              className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={onAddEvent} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
            >
              Add Event
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsAddingEvent(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-2 rounded-md"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-3">
        {events.length === 0 && !isAddingEvent && (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
            No events added yet. Keep track of important dates for you and your loved ones.
          </p>
        )}

        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(event.date).toLocaleDateString()} • {event.relationship}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveEvent(event.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Button */}
      {!isAddingEvent && (
        <Button
          variant="outline"
          onClick={() => setIsAddingEvent(true)}
          className="w-full mt-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Birthday or Anniversary
        </Button>
      )}
    </Card>
  );
};

export default BirthdayAnniversaryCard;
