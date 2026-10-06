import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { IconButton } from './IconButton';

export interface SidebarTab {
  id: string;
  label: string;
  /** Tabs with no content are not offered. */
  content: ReactNode | null;
}

export interface SidebarProps {
  tabs: readonly SidebarTab[];
}

/**
 * Collapsible left inspector with tab semantics (document-sidebar spec). It stays mounted while collapsed, so
 * reopening restores the same tab. Tabs follow the standard pattern: arrow keys move between tabs.
 */
export function Sidebar({ tabs }: SidebarProps) {
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const baseId = useId();
  const available = tabs.filter((t) => t.content !== null);
  const active = available.find((t) => t.id === activeId) ?? available[0];

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = available.findIndex((t) => t.id === active?.id);
    const move = (to: number) => {
      const next = available[(to + available.length) % available.length];
      if (!next) return;
      event.preventDefault();
      setActiveId(next.id);
      document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
    };
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(available.length - 1);
  };

  if (available.length === 0) return null;

  return (
    <aside
      aria-label="Inspector"
      data-testid="sidebar"
      data-open={open}
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-white ${open ? 'w-72' : 'w-10'}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-1">
        {open && (
          <div role="tablist" aria-label="Inspector tabs" className="flex min-w-0 gap-1">
            {available.map((tab) => {
              const selected = tab.id === active?.id;
              return (
                <button
                  key={tab.id}
                  id={`${baseId}-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(tab.id)}
                  onKeyDown={onTabKeyDown}
                  className={`rounded-md px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    selected ? 'bg-blue-100 text-blue-900' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        <IconButton label={open ? 'Collapse sidebar' : 'Open sidebar'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <PanelLeftClose aria-hidden="true" className="size-4" /> : <PanelLeftOpen aria-hidden="true" className="size-4" />}
        </IconButton>
      </div>
      {open &&
        available.map((tab) => (
          <div
            key={tab.id}
            id={`${baseId}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={tab.id !== active?.id}
            className="flex min-h-0 flex-1 flex-col"
          >
            {tab.id === active?.id ? tab.content : null}
          </div>
        ))}
    </aside>
  );
}
