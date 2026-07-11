import { SiteHeader } from "@/components/site-header";
import { ImportFlow } from "@/app/import-flow";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <ImportFlow />
      </main>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        CRMerge — AI CSV Importer
      </footer>
    </div>
  );
}
