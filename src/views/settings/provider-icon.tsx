import { Cloud, Wifi, Github } from 'lucide-react';

type LucideComponent = React.ComponentType<{ className?: string }>;

const ICON_MAP: Record<string, LucideComponent> = {
  wifi: Wifi,
  github: Github,
  cloud: Cloud,
};

export function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Cloud;
  return <Icon className={className} />;
}
