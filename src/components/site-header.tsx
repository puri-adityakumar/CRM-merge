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
            viewBox="0 0 28 28"
            fill="none"
            className="size-7 shrink-0"
            aria-hidden
          >
            <rect width="28" height="28" rx="7" className="fill-primary" />
            <path d="M9 7h5l3.5 3.5V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" className="fill-primary/20 stroke-primary-foreground" strokeWidth="1" />
            <path d="M14 7v3.5h3.5" className="stroke-primary-foreground" strokeWidth="1" />
            <path d="M10 13h5M10 16h4" className="stroke-primary-foreground" strokeWidth="1" strokeLinecap="round" />
            <path d="M16 4.5 17.5 6l1.5-1.5L17.5 3Z" className="fill-primary-foreground" />
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
