import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
      aria-label="New task"
    >
      <Plus className="h-6 w-6" />
    </motion.button>
  );
}
