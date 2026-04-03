import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode, KeyboardEventHandler } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import { BottomSheet } from './bottom-sheet';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  /** Used as the accessible Dialog.Title on desktop */
  title: string;
  children: ReactNode;
  /** Max-width of the desktop card: 'sm' = max-w-sm, 'lg' = max-w-lg. Default 'lg'. */
  maxWidth?: 'sm' | 'lg';
  /** Desktop-only: vertical alignment. Default 'center'. 'top' positions at ~20% from top. */
  desktopPosition?: 'center' | 'top';
  onKeyDown?: KeyboardEventHandler;
  /** Desktop-only: Radix onOpenAutoFocus override */
  onOpenAutoFocus?: (e: Event) => void;
}

/**
 * Responsive modal wrapper.
 * - Mobile  → slides up as a bottom sheet (via BottomSheet)
 * - Desktop → centered Radix Dialog
 *
 * Children should be composed as:
 *   <header> (flex-shrink-0)
 *   <scrollable-body> (flex-1 overflow-y-auto min-h-0)
 *   <footer> (flex-shrink-0)
 */
export function ModalSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = 'lg',
  desktopPosition = 'center',
  onKeyDown,
  onOpenAutoFocus,
}: ModalSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} onKeyDown={onKeyDown}>
        {children}
      </BottomSheet>
    );
  }

  // Desktop: Radix Dialog
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-50 flex p-4 focus:outline-none',
            desktopPosition === 'top'
              ? 'items-start justify-center pt-[20%]'
              : 'items-center justify-center'
          )}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <div
            className={cn(
              'bg-background border border-border rounded-xl shadow-2xl w-full flex flex-col',
              maxWidth === 'sm'
                ? 'max-w-sm max-h-[85vh]'
                : 'max-w-lg max-h-[90vh]'
            )}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
