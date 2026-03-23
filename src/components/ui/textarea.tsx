import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-border bg-white/70 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-accent focus:ring-4 focus:ring-accent/15 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  );
}

