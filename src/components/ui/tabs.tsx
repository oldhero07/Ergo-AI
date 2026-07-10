import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal ARIA tabs used for mode (photo/video) and method (RULA/REBA/OWAS)
 * switches. Value-controlled only - panels are rendered by the caller, so
 * `TabsList`/`TabsTrigger` act as an accessible segmented control.
 */
type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  idBase: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be used within <Tabs>`);
  return ctx;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  const idBase = React.useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, idBase }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      const list = e.currentTarget;
      const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (tabs.length === 0) return;
      let next = current;
      if (e.key === "ArrowLeft") next = current <= 0 ? tabs.length - 1 : current - 1;
      else if (e.key === "ArrowRight") next = current === tabs.length - 1 ? 0 : current + 1;
      else if (e.key === "Home") next = 0;
      else next = tabs.length - 1;
      e.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    };
    return (
      <div
        ref={ref}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const ctx = useTabsContext("TabsTrigger");
    const selected = ctx.value === value;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${ctx.idBase}-tab-${value}`}
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) ctx.onValueChange(value);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          selected ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export { Tabs, TabsList, TabsTrigger };
