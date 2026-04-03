import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode, KeyboardEventHandler } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind height/max-height class for the sheet panel. Defaults to 'h-[90vh]'. */
  height?: string;
  onKeyDown?: KeyboardEventHandler;
}

export function BottomSheet({ open, onClose, children, height = 'h-[90vh]', onKeyDown }: BottomSheetProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={onClose}
          />

          {/* Sheet */}
          <motion.div
            className={cn('fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl flex flex-col', height)}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
            onKeyDown={onKeyDown}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Content — children own their scroll */}
            <div
              className="flex flex-col flex-1 overflow-hidden min-h-0"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {children}
            </div>

            {/* Safe area bottom padding */}
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
