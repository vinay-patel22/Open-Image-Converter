import { useEffect, useState } from "react";
import { useAppStore } from "../../state/store";

/** Screen-reader summary of queue state, announced politely (PRD §14). */
export function QueueLiveRegion() {
  const items = useAppStore((state) => state.items);
  const [message, setMessage] = useState("");

  const counts = {
    total: items.length,
    ready: items.filter((item) => item.status === "ready").length,
    unsupported: items.filter((item) => item.status === "failed").length,
    validating: items.filter((item) => item.status === "validating").length,
  };

  useEffect(() => {
    if (counts.total === 0) {
      setMessage("");
      return;
    }
    const parts: string[] = [`${counts.total} images in the queue.`];
    if (counts.validating) parts.push(`${counts.validating} checking.`);
    if (counts.ready) parts.push(`${counts.ready} ready.`);
    if (counts.unsupported) parts.push(`${counts.unsupported} unsupported.`);
    setMessage(parts.join(" "));
  }, [counts.total, counts.ready, counts.unsupported, counts.validating]);

  return (
    <div aria-live="polite" role="status" className="sr-only">
      {message}
    </div>
  );
}
