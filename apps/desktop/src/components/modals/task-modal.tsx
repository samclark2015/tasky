import { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Task, RecurrenceRule } from '@core/types';
import { useTaskStore, useListStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { cn, minutesToHHMM, hhmmToMinutes, localDateFromString } from '@/lib/utils';
import { X, Calendar, Tag, AlignLeft, Clock, Flag, List } from 'lucide-react';
import { TagInput } from '@/components/task/tag-input';
import { RecurrenceEditor } from '@/components/task/recurrence-editor';

interface TaskModalProps {
  /** If provided, editing an existing task. If null, creating new. */
  task?: Task | null;
  /** Default values when creating */
  defaults?: { 
    title?: string;
    description?: string;
    listId?: string; 
    dueDate?: string; 
    parentId?: string; 
    timeEstimate?: number;
    sourceEventUid?: string;
  };
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-destructive' },
];

function parseDueDate(dueDate: string | null | undefined): { date: string; time: string } {
  if (!dueDate) return { date: '', time: '' };
  if (dueDate.includes('T')) {
    const d = new Date(dueDate);
    const date = dueDate.split('T')[0];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const hasRealTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    return { date, time: hasRealTime ? `${hours}:${mins}` : '' };
  }
  return { date: dueDate, time: '' };
}

function buildDueDate(date: string, time: string): string | null {
  if (!date) return null;
  if (!time) return date;
  const [h, m] = time.split(':').map(Number);
  return localDateFromString(date, h, m).toISOString();
}

export function TaskModal({ task, defaults, onClose }: TaskModalProps) {
  const { createTask, updateTask } = useTaskStore();
  const { lists } = useListStore();
  const { adapter } = useApp();

  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? defaults?.description ?? '');
  const parsed = parseDueDate(task?.dueDate ?? defaults?.dueDate);
  const [dueDate, setDueDate] = useState(parsed.date);
  const [dueTime, setDueTime] = useState(parsed.time);
  const [allDay, setAllDay] = useState(!parsed.time);
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium');
  const [listId, setListId] = useState(task?.listId ?? defaults?.listId ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [timeEstimate, setTimeEstimate] = useState(
    task?.timeEstimate ? minutesToHHMM(task.timeEstimate)
      : defaults?.timeEstimate ? minutesToHHMM(defaults.timeEstimate)
      : ''
  );
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(task?.recurrence ?? null);
  const [saving, setSaving] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!title.trim() || !adapter) return;
    setSaving(true);
    try {
      const dueDateValue = buildDueDate(dueDate, dueTime);
      const estimateMinutes = hhmmToMinutes(timeEstimate);

      if (task) {
        await updateTask(adapter, task.id, {
          title: title.trim(),
          description,
          dueDate: dueDateValue,
          priority,
          listId: listId || null,
          notes,
          tags,
          timeEstimate: estimateMinutes,
          recurrence,
        });
      } else {
        await createTask(adapter, {
          title: title.trim(),
          description,
          dueDate: dueDateValue,
          priority,
          listId: listId || null,
          notes,
          tags,
          timeEstimate: estimateMinutes,
          recurrence,
          parentId: defaults?.parentId ?? null,
          sourceEventUid: defaults?.sourceEventUid ?? null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  function clearDueDate() {
    setDueDate('');
    setDueTime('');
    setAllDay(true);
  }

  function handleAllDayToggle(checked: boolean) {
    setAllDay(checked);
    if (checked) setDueTime('');
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
        >
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <Dialog.Title className="sr-only">{task ? 'Edit Task' : 'New Task'}</Dialog.Title>
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="font-semibold text-sm text-muted-foreground">
            {task ? 'Edit Task' : 'New Task'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {/* title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full text-base font-medium bg-transparent outline-none placeholder:text-muted-foreground/60 border-b border-border pb-2"
          />

          {/* description */}
          <div className="flex gap-2">
            <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* due date + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {dueDate ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm bg-transparent outline-none text-foreground [color-scheme:dark] dark:[color-scheme:dark]"
              />
            ) : (
              <label className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                No due date
                <input type="date" value="" onChange={(e) => { setDueDate(e.target.value); setAllDay(true); }} className="sr-only" />
              </label>
            )}
            {dueDate && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => handleAllDayToggle(e.target.checked)}
                  className="rounded"
                />
                All day
              </label>
            )}
            {dueDate && !allDay && (
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="No time"
                className="text-sm bg-transparent outline-none text-foreground [color-scheme:dark] dark:[color-scheme:dark] w-28"
              />
            )}
            {dueDate && (
              <button
                onClick={clearDueDate}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear due date"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* time estimate */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={timeEstimate}
              onChange={(e) => setTimeEstimate(e.target.value)}
              placeholder="hh:mm"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground w-full"
            />
          </div>

          {/* priority */}
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    priority === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* list */}
          {lists.length > 0 && (
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-foreground"
              >
                <option value="">No list (Inbox)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* tags */}
          <div className="flex items-start gap-2">
            <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            <TagInput tags={tags} onChange={setTags} className="flex-1" />
          </div>

          {/* recurrence */}
          <RecurrenceEditor value={recurrence} onChange={setRecurrence} />

          {/* notes */}
          <div className="flex gap-2">
            <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">⌘↵ to save</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : task ? 'Save' : 'Add Task'}
            </button>
          </div>
        </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
