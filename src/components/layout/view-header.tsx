import type { ReactNode } from 'react';

interface ViewHeaderProps {
  children: ReactNode;
  actions?: ReactNode;
}

export function ViewHeader({ children, actions }: ViewHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 py-4 border-b border-border flex-shrink-0">
      <div className="flex-1 min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}
