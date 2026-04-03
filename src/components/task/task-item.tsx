import { useState } from 'react';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { useTaskStore, useUIStore } from '@/stores';
import { useApp } from '@/components/app-provider';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useLongPress } from '@/hooks/use-long-press';
import { Circle, CheckCircle2, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { Task } from '@/types/types';
import { QuickAdd } from './quick-add';
import { TaskContextMenu } from './task-context-menu';
import { BottomSheet } from '@/components/layout/bottom-sheet';
import { TaskModal } from '@/components/modals/task-modal';

interface TaskItemProps {
  task: Task;
  depth?: number;
  showList?: boolean;
  listColor?: string | null;
}

export function TaskItem({ task, depth = 0, showList, listColor }: TaskItemProps) {
  const { selectTask, selectedTaskId } = useUIStore();
  const { toggleComplete, createTask, getSubtasks, deleteTask } = useTaskStore();
  const { adapter } = useApp();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(true);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(false);

  const subtasks = getSubtasks(task.id);
  const hasSubtasks = subtasks.length > 0;
  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  function handleAddSubtask(title: string) {
    if (!adapter) return;
    createTask(adapter, { title, parentId: task.id, listId: task.listId });
    setAddingSubtask(false);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (isMobile) setActionSheetOpen(true);
    },
  });

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 pr-3 cursor-pointer hover:bg-accent/40 transition-colors rounded-md',
          isMobile ? 'py-3' : 'py-2',
          selectedTaskId === task.id && 'bg-accent',
          depth > 0 ? 'pl-' + (4 + depth * 6) : 'pl-3'
        )}
        style={{ paddingLeft: depth > 0 ? `${12 + depth * 20}px` : undefined }}
        onClick={() => selectTask(task.id)}
        onContextMenu={!isMobile ? handleContextMenu : undefined}
        {...(isMobile ? longPressHandlers : {})}
      >
        {/* expand toggle */}
        <button
          className={cn(
            'flex-shrink-0 text-muted-foreground transition-colors',
            hasSubtasks ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* complete toggle */}
        <button
          className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => { e.stopPropagation(); if (adapter) toggleComplete(adapter, task.id); }}
        >
          {task.completed ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        {/* list color dot */}
        {showList && listColor && (
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: listColor }}
          />
        )}

        {/* title */}
        <span
          className={cn(
            'flex-1 min-w-0 text-sm truncate',
            task.completed && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </span>

        {/* subtask progress */}
        {hasSubtasks && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {completedSubtasks}/{subtasks.length}
          </span>
        )}

        {/* due date */}
        {task.dueDate && (
          <span
            className={cn(
              'text-xs flex-shrink-0',
              isOverdue(task.dueDate) && !task.completed
                ? 'text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {formatDate(task.dueDate)}
          </span>
        )}

        {/* priority dot */}
        {task.priority === 'high' && !task.completed && (
          <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
        )}
        {task.priority === 'medium' && !task.completed && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
        )}

        {/* add subtask button (hover, desktop only) */}
        {!isMobile && (
          <button
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setAddingSubtask((v) => !v); }}
            title="Add subtask"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* subtasks */}
      {expanded && (
        <>
          {subtasks.map((sub) => (
            <TaskItem key={sub.id} task={sub} depth={depth + 1} />
          ))}
          {addingSubtask && (
            <div style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}>
              <QuickAdd
                onAdd={handleAddSubtask}
                placeholder="Add subtask…"
                className="border-0 py-1.5"
              />
            </div>
          )}
        </>
      )}

      {/* Desktop context menu */}
      {contextMenu && (
        <TaskContextMenu
          task={task}
          pos={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Mobile long-press action sheet */}
      <BottomSheet open={actionSheetOpen} onClose={() => setActionSheetOpen(false)}>
        <div className="px-4 py-2">
          <p className="text-sm font-medium text-muted-foreground mb-2 truncate">{task.title}</p>
          <div className="space-y-1">
            <button
              onClick={() => { setActionSheetOpen(false); setEditingTask(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left text-sm font-medium"
            >
              Edit Task
            </button>
            <button
              onClick={() => { setActionSheetOpen(false); setExpanded(true); setAddingSubtask(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors text-left text-sm font-medium"
            >
              Add Subtask
            </button>
            <button
              onClick={() => {
                setActionSheetOpen(false);
                if (adapter) deleteTask(adapter, task.id);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-destructive/10 transition-colors text-left text-sm font-medium text-destructive"
            >
              Delete
            </button>
          </div>
        </div>
      </BottomSheet>

      {editingTask && (
        <TaskModal task={task} onClose={() => setEditingTask(false)} />
      )}
    </div>
  );
}
