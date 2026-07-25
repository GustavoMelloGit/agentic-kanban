import { bus } from "../../../lib/bus";
import { getBoard } from "../../../lib/store";
import { logErro } from "../../../lib/log";

export const dynamic = "force-dynamic";

// Server-Sent Events: manda o board inteiro na conexão e a cada mudança.
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enviar = (conteudo: string, contexto: string) => {
        try {
          controller.enqueue(encoder.encode(conteudo));
        } catch (erro) {
          logErro(`SSE ${contexto} (stream provavelmente fechado)`, erro);
        }
      };

      const enviarBoard = () => enviar(`data: ${JSON.stringify(getBoard())}\n\n`, "snapshot");

      enviarBoard();
      bus.on("change", enviarBoard);

      // Heartbeat pra intermediários não derrubarem conexão ociosa.
      const ping = setInterval(() => enviar(": ping\n\n", "ping"), 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        bus.off("change", enviarBoard);
        try {
          controller.close();
        } catch (erro) {
          logErro("fechamento do stream SSE (já fechado)", erro);
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
