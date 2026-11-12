import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { uiActions } from "@/store/slices/uiSlice";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { ThemeMode } from "@/types";

/** Keeps the `dark` class and Redux `resolvedTheme` in sync with the OS preference. */
export function useThemeSync() {
  const dispatch = useAppDispatch();
  const resolved = useAppSelector((s) => s.ui.resolvedTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => dispatch(uiActions.systemThemeChanged());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [dispatch]);
}

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

/** Fixed-width segmented control: switching never shifts layout. */
export function ThemeSwitcher() {
  const theme = useAppSelector((s) => s.ui.theme);
  const dispatch = useAppDispatch();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex h-8 items-center rounded-md border bg-muted/50 p-0.5">
      {OPTIONS.map(({ mode, label, icon: Icon }) => (
        <Tooltip key={mode} label={label}>
          <button
            role="radio"
            aria-checked={theme === mode}
            aria-label={label}
            onClick={() => dispatch(uiActions.themeSet(mode))}
            className={cn(
              "flex size-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:text-foreground",
              theme === mode && "bg-background text-foreground shadow-sm ring-1 ring-border",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

