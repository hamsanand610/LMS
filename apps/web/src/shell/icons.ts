import {
  Activity,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  Code2,
  FileText,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  Palette,
  ScrollText,
  Settings,
  Shield,
  ToggleLeft,
  TrendingUp,
  Users,
} from 'lucide-react';

/** Icon names used in module manifests → Lucide components. Unknown names fall back to a dashboard icon. */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  settings: Settings,
  palette: Palette,
  'toggle-left': ToggleLeft,
  'list-tree': ListTree,
  shield: Shield,
  'scroll-text': ScrollText,
  activity: Activity,
  'book-open': BookOpen,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  'trending-up': TrendingUp,
  'clipboard-list': ClipboardList,
  'file-text': FileText,
  code: Code2,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? LayoutDashboard;
}
