import { Header } from "./app/components/Header";
import { Hero } from "./app/components/Hero";
import { UploadZone } from "./app/components/UploadZone";
import { ConvertPanel } from "./app/components/ConvertPanel";
import { FileQueue } from "./app/components/FileQueue";
import { Footer } from "./app/components/Footer";
import { QueueLiveRegion } from "./app/components/QueueLiveRegion";
import { useAppStore } from "./state/store";
import { useEffect } from "react";

export default function App() {
  const itemCount = useAppStore((state) => state.items.length);

  // Add reload confirmation when data exists
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (itemCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [itemCount]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className={itemCount === 0 ? "mx-auto h-full w-full max-w-5xl px-4 sm:px-6 py-6 flex flex-col" : "mx-auto h-full w-full max-w-5xl px-4 sm:px-6 py-6 flex flex-col"}>
          {itemCount === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <Hero />
              <div className="w-full">
                <UploadZone compact={false} />
              </div>
            </div>
          ) : (
            <>
              <Hero />
              <div className="mt-4 grid gap-3 flex-1 min-h-0">
                <UploadZone compact={true} />
                <div className="flex flex-col gap-3 min-h-0">
                  <FileQueue />
                  <ConvertPanel />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
      <QueueLiveRegion />
    </div>
  );
}
