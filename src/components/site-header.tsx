"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <p
            className="text-xl sm:text-2xl font-semibold -tracking-[0.03em]"
            style={{ fontFamily: "var(--font-museo-moderno)" }}
          >
            CRMerge
          </p>
          <span className="hidden text-xs text-muted-foreground sm:inline">AI CSV to structured output</span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle dark mode"
          onClick={() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
        >
          <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </div>
    </header>
  );
}
