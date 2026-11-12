import { Binary, Braces, Calendar, Hash, Percent, ToggleLeft, Type } from "lucide-react";
import type { ColType } from "@/types";
import { cn } from "@/lib/utils";

export const TYPE_META: Record<ColType, { icon: typeof Hash; label: string; cls: string }> = {
  integer: { icon: Hash, label: "int", cls: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  double: { icon: Percent, label: "double", cls: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  boolean: { icon: ToggleLeft, label: "bool", cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  timestamp: { icon: Calendar, label: "time", cls: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  varchar: { icon: Type, label: "text", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  json: { icon: Braces, label: "json", cls: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

export function TypeIcon({ type, className }: { type: ColType; className?: string }) {
  const Icon = TYPE_META[type]?.icon ?? Binary;
  return <Icon className={cn("size-3", className)} />;
}

export function TypePill({ type, raw }: { type: ColType; raw?: string }) {
  const m = TYPE_META[type];
  return (
    <span
      title={raw}
      className={cn("inline-flex items-center gap-1 rounded border px-1 py-px font-mono text-[9px] leading-none", m.cls)}
    >
      <TypeIcon type={type} className="size-2.5" />
      {m.label}
    </span>
  );
}

