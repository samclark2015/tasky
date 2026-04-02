import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useUIStore, useTaskStore, useListStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import {
  X, Trash2, Circle, CheckCircle2, Calendar, Flag, Tag,
  AlignLeft, Clock, List, ChevronRight, ChevronDown, Check, Plus,
} from 'lucide-react';
import { cn, formatDate, isOverdue, minutesToHHMM, hhmmToMinutes, localDateFromString } from '@/lib/utils';
import type { Task } from '@/types/types';
import { TaskModal } from '@/components/modals/task-modal';
import { QuickAdd } from '@/components/task/quick-add';
import { TaskItem } from '@/components/task/task-item';
import { TagInput } from '@/components/task/tag-input';
import { RecurrenceEditor } from '@/components/task/recurrence-editor';

function InlineField({
  label, icon, value, onSave, type = 'text', placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'date' | 'textarea' | 'number';
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  return (
    <div className="flex items-start gap-2.5 group">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {editing ? (
          type === 'textarea' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKey}
              rows={3}
              className="w-full text-sm bg-input/30 border border-border rounded px-2 py-1 outline-none resize-none"
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKey}
              placeholder={placeholder}
              className="w-full text-sm bg-input/30 border border-border rounded px-2 py-1 outline-none"
            />
          )
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              'text-sm text-left w-full rounded px-1 -ml-1 py-0.5 hover:bg-accent/50 transition-colors',
              !value && 'text-muted-foreground italic'
            )}
          >
            {value || placeholder || `Set ${label.toLowerCase()}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function DetailsPanel() {
  const { selectedTaskId, setDetailsPanelOpen, selectTask } = useUIStore();
  const { tasks, toggleComplete, deleteTask, updateTask, createTask, getSubtasks } = useTaskStore();
  const { lists } = useListStore();
  const { adapter } = useApp();
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const task = selectedTaskId ? tasks.get(selectedTaskId) : null;
  const subtasks = task ? getSubtasks(task.id) : [];
  // list used for display context in future; suppress unused warning
  void (task?.listId ? lists.find((l) => l.id === task.listId) : null);

  useEffect(() => { setAddingSubtask(false); }, [selectedTaskId]);

  if (!task) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-medium text-sm">Details</span>
          <button onClick={() => setDetailsPanelOpen(false)} className="p-1 rounded hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No task selected
        </div>
      </div>
    );
  }

  function save(updates: Partial<Task>) {
    if (!adapter || !task) return;
    updateTask(adapter, task.id, updates);
  }

  async function handleDelete() {
    if (!adapter || !task) return;
    await deleteTask(adapter, task.id);
    setDetailsPanelOpen(false);
  }

  function handleAddSubtask(title: string) {
    if (!adapter || !task) return;
    createTask(adapter, { title, parentId: task.id, listId: task.listId });
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {task.parentId && (
              <button
                onClick={() => selectTask(task.parentId)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
                Parent
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={() => setDetailsPanelOpen(false)} className="p-1 rounded hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            {/* title + complete */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => adapter && toggleComplete(adapter, task.id)}
                className="mt-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              >
                {task.completed
                  ? <CheckCircle2 className="h-5 w-5 text-primary" />
                  : <Circle className="h-5 w-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <InlineField
                  label=""
                  icon={<span />}
                  value={task.title}
                  onSave={(v) => v.trim() && save({ title: v.trim() })}
                  placeholder="Task title"
                />
              </div>
            </div>

            {/* description */}
            <InlineField
              label="Description"
              icon={<AlignLeft className="h-4 w-4" />}
              value={task.description}
              onSave={(v) => save({ description: v })}
              type="textarea"
              placeholder="Add a description…"
            />

            {/* due date + time */}
            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Due date</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {task.dueDate ? (
                    <input
                      type="date"
                      value={task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate}
                      onChange={(e) => {
                        const date = e.target.value;
                        if (!date) { save({ dueDate: null }); return; }
                        const existing = task.dueDate;
                        if (existing?.includes('T')) {
                          const d = new Date(existing);
                          const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                          save({ dueDate: hasTime ? localDateFromString(date, d.getHours(), d.getMinutes()).toISOString() : date });
                        } else {
                          save({ dueDate: date });
                        }
                      }}
                      className={cn(
                        'text-sm bg-transparent outline-none [color-scheme:dark] dark:[color-scheme:dark]',
                        isOverdue(task.dueDate) && !task.completed && 'text-destructive'
                      )}
                    />
                  ) : (
                    <label className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      No due date
                      <input type="date" value="" onChange={(e) => { if (e.target.value) save({ dueDate: e.target.value }); }} className="sr-only" />
                    </label>
                  )}
                  {task.dueDate && (() => {
                    const hasTime = task.dueDate.includes('T') && (() => { const d = new Date(task.dueDate!); return d.getHours() !== 0 || d.getMinutes() !== 0; })();
                    return (
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!hasTime}
                          onChange={(e) => {
                            const dateStr = task.dueDate!.includes('T') ? task.dueDate!.split('T')[0] : task.dueDate!;
                            if (e.target.checked) {
                              save({ dueDate: dateStr });
                            } else {
                              save({ dueDate: localDateFromString(dateStr, 9).toISOString() });
                            }
                          }}
                          className="rounded"
                        />
                        All day
                      </label>
                    );
                  })()}
                  {task.dueDate && task.dueDate.includes('T') && (() => { const d = new Date(task.dueDate!); return d.getHours() !== 0 || d.getMinutes() !== 0; })() && (
                    <input
                      type="time"
                      value={(() => {
                        const d = new Date(task.dueDate!);
                        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      })()}
                      onChange={(e) => {
                        const time = e.target.value;
                        const dateStr = task.dueDate?.includes('T') ? task.dueDate.split('T')[0] : task.dueDate ?? '';
                        if (!dateStr) return;
                        if (!time) { save({ dueDate: dateStr }); return; }
                        const [h, m] = time.split(':').map(Number);
                        save({ dueDate: localDateFromString(dateStr, h, m).toISOString() });
                      }}
                      className="text-sm bg-transparent outline-none [color-scheme:dark] dark:[color-scheme:dark] w-28"
                    />
                  )}
                  {task.dueDate && (
                    <button
                      onClick={() => save({ dueDate: null })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear due date"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* priority */}
            <div className="flex items-start gap-2.5">
              <Flag className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high'] as Task['priority'][]).map((p) => (
                    <button
                      key={p}
                      onClick={() => save({ priority: p })}
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors capitalize',
                        task.priority === p
                          ? p === 'high' ? 'bg-destructive text-white border-destructive'
                            : p === 'medium' ? 'bg-yellow-500 text-white border-yellow-500'
                            : 'bg-muted text-foreground border-muted-foreground/30'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* list */}
            <div className="flex items-start gap-2.5">
              <List className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">List</p>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="text-sm text-foreground flex items-center gap-1 outline-none hover:text-foreground/80">
                      {task.listId ? (lists.find((l) => l.id === task.listId)?.name ?? 'Inbox') : 'Inbox'}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="start"
                      sideOffset={4}
                      className="z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
                    >
                      <DropdownMenu.Item
                        onSelect={() => save({ listId: null })}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                      >
                        {!task.listId ? <Check className="h-3 w-3" /> : <span className="h-3 w-3" />}
                        Inbox
                      </DropdownMenu.Item>
                      {lists.map((l) => (
                        <DropdownMenu.Item
                          key={l.id}
                          onSelect={() => save({ listId: l.id })}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none data-[highlighted]:bg-accent"
                        >
                          {task.listId === l.id ? <Check className="h-3 w-3" /> : <span className="h-3 w-3" />}
                          {l.name}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>

            {/* time estimate */}
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Time estimate</p>
                <input
                  key={task.id}
                  type="text"
                  defaultValue={task.timeEstimate != null ? minutesToHHMM(task.timeEstimate) : ''}
                  onBlur={(e) => save({ timeEstimate: hhmmToMinutes(e.target.value) })}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  placeholder="hh:mm"
                  className="text-sm bg-transparent outline-none w-24 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* tags */}
            <div className="flex items-start gap-2.5">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Tags</p>
                <TagInput tags={task.tags} onChange={(tags) => save({ tags })} />
              </div>
            </div>

            {/* recurrence */}
            <div className="flex items-start gap-2.5">
              <div className="w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <RecurrenceEditor
                  value={task.recurrence}
                  onChange={(rule) => save({ recurrence: rule })}
                />
              </div>
            </div>

            {/* notes */}
            <InlineField
              label="Notes"
              icon={<AlignLeft className="h-4 w-4" />}
              value={task.notes}
              onSave={(v) => save({ notes: v })}
              type="textarea"
              placeholder="Add notes…"
            />

            {/* subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Subtasks {subtasks.length > 0 && `(${subtasks.filter(s => s.completed).length}/${subtasks.length})`}
                </p>
                <button
                  onClick={() => setAddingSubtask((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                {subtasks.map((sub) => (
                  <TaskItem key={sub.id} task={sub} depth={0} />
                ))}
              </div>
              {addingSubtask && (
                <QuickAdd
                  onAdd={handleAddSubtask}
                  placeholder="Add subtask…"
                  className="border-0 px-0 mt-1"
                />
              )}
            </div>

            {/* metadata */}
            <div className="pt-2 border-t border-border space-y-1">
              <p className="text-xs text-muted-foreground">
                Created {formatDate(task.createdAt, 'long')}
              </p>
              {task.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed {formatDate(task.completedAt, 'long')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <TaskModal task={task} onClose={() => setEditing(false)} />
      )}
    </>
  );
}


