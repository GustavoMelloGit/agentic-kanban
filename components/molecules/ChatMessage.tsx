import Markdown from "@/components/atoms/Markdown";
import type { ChatMessage as Mensagem } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

const ROTULO = { user: "Você", agent: "Agente" } as const;

// Só a resposta do agente vira markdown; a do usuário segue texto puro pra
// preservar exatamente o que foi digitado.
export default function ChatMessage({ message }: { message: Mensagem }) {
  const doUsuario = message.role === "user";

  return (
    <div className={cn("flex max-w-[90%] flex-col gap-[3px]", doUsuario && "items-end self-end")}>
      <span className="text-faint text-[11px] tracking-[0.06em] uppercase">
        {ROTULO[message.role]}
      </span>
      <div
        className={cn(
          "rounded-md border px-3 py-2 wrap-break-word whitespace-pre-wrap",
          doUsuario
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-surface-2 border-border"
        )}
      >
        {doUsuario ? message.content : <Markdown content={message.content} />}
      </div>
    </div>
  );
}
