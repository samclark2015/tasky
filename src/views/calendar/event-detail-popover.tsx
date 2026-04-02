import { useState } from 'react';
import type { CalendarEvent } from '@/types/types';
import { X, Plus } from 'lucide-react';

interface EventDetailPopoverProps {
  event: CalendarEvent;
  pos: { x: number; y: number };
  onClose: () => void;
  onAddToTasks: (event: CalendarEvent) => void;
}

export function EventDetailPopover({ event, pos, onClose, onAddToTasks }: EventDetailPopoverProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToTasks = async () => {
    setIsAdding(true);
    try {
      onAddToTasks(event);
      onClose();
    } catch (e) {
      console.error('Failed to add event to tasks:', e);
      setIsAdding(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Popover */}
      <div
        className="fixed z-50 w-80 rounded-lg border border-border bg-popover p-4 shadow-lg"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          transform: 'translate(-50%, 10px)',
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-lg">{event.summary}</h3>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          {event.dtstart && (
            <div>
              <span className="font-medium">Start: </span>
              <span className="text-muted-foreground">
                {new Date(event.dtstart).toLocaleString()}
              </span>
            </div>
          )}

          {event.dtend && (
            <div>
              <span className="font-medium">End: </span>
              <span className="text-muted-foreground">
                {new Date(event.dtend).toLocaleString()}
              </span>
            </div>
          )}

          {event.location && (
            <div>
              <span className="font-medium">Location: </span>
              <span className="text-muted-foreground">{event.location}</span>
            </div>
          )}

          {event.description && (
            <div>
              <span className="font-medium">Description: </span>
              <p className="text-muted-foreground whitespace-pre-wrap mt-1">
                {event.description}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <button
            onClick={handleAddToTasks}
            disabled={isAdding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            {isAdding ? 'Adding...' : 'Add to Tasks'}
          </button>
        </div>
      </div>
    </>
  );
}
