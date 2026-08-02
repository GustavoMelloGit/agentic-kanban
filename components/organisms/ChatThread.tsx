import Spinner from "@/components/atoms/Spinner";
import ChatMessage from "@/components/molecules/ChatMessage";
import type { ChatMessage as Mensagem } from "@/lib/config";

export default function ChatThread({
  messages,
  pensando,
}: {
  messages: Mensagem[];
  pensando: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((mensagem, indice) => (
        <ChatMessage key={indice} message={mensagem} />
      ))}

      {pensando && (
        <div className="flex max-w-[90%] flex-col gap-[3px]">
          <span className="text-faint text-[11px] tracking-[0.06em] uppercase">Agente</span>
          <div
            role="status"
            className="bg-surface-2 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2"
          >
            <Spinner size="md" />
            pensando…
          </div>
        </div>
      )}
    </div>
  );
}
