import { bus } from "../../../lib/bus";
import { getBoard } from "../../../lib/store";

export const dynamic = "force-dynamic";

// Server-Sent Events: push the full board snapshot on connect and on every change.
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(getBoard())}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      send(); // initial snapshot
      const onChange = () => send();
      bus.on("change", onChange);

      // Heartbeat keeps intermediaries from dropping an idle connection.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        bus.off("change", onChange);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
