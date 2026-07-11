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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            className="size-6 shrink-0"
            aria-hidden
          >
            <path d="M7 5h5l3 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" className="fill-primary/20 stroke-primary" strokeWidth="1.25" />
            <path d="M12 5v3h3" className="stroke-primary" strokeWidth="1.25" />
            <path d="M9 11h4M9 14h3" className="stroke-primary" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">CRMerge</p>
            <p className="text-xs text-muted-foreground">
              AI CSV to structured output
            </p>
          </div>
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
