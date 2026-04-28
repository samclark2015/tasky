import { ModalSheet } from '@/components/layout/modal-sheet';

interface SecondaryAction {
  label: string;
  onClick: () => void;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  secondaryAction?: SecondaryAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  secondaryAction,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalSheet open onClose={onCancel} title={title} maxWidth="sm">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <span className="font-semibold text-sm">{title}</span>
      </div>

      <div className="px-5 py-4 flex-1">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      <div className="flex flex-col gap-2 px-5 py-3 border-t border-border flex-shrink-0">
        <button
          onClick={onConfirm}
          className={
            variant === 'destructive'
              ? 'w-full px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors'
              : 'w-full px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
          }
        >
          {confirmLabel}
        </button>
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="w-full px-4 py-2 rounded-md text-sm border border-border hover:bg-accent transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          {cancelLabel}
        </button>
      </div>
    </ModalSheet>
  );
}
