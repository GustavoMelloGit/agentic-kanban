import Icon from "@/components/atoms/Icon";
import Markdown from "@/components/atoms/Markdown";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import type { ChatMessage as Mensagem } from "@/lib/config";
import { cn } from "@/lib/ui/utils";

const ROTULO = { user: "Você", agent: "Agente" } as const;

// Só a resposta do agente vira markdown; a do usuário segue texto puro pra
// preservar exatamente o que foi digitado.
// Turno que falhou continua na thread — é onde se lê o que quebrou —, mas
// anunciado como falha: o texto ali é traceback, não resposta ao usuário.
export default function ChatMessage({ message }: { message: Mensagem }) {
  const doUsuario = message.role === "user";
  const falhou = message.ok === false;

  return (
    <Message align={doUsuario ? "end" : "start"}>
      <MessageContent>
        <MessageHeader
          className={cn(
            "text-faint text-[11px] tracking-[0.06em] uppercase",
            falhou && "text-danger flex items-center gap-1"
          )}
        >
          {falhou && <Icon name="alerta" size="sm" />}
          {falhou ? `${ROTULO[message.role]} · falhou` : ROTULO[message.role]}
        </MessageHeader>
        <Bubble variant={doUsuario ? "default" : "outline"}>
          <BubbleContent
            className={cn(
              doUsuario ? "whitespace-pre-wrap" : "bg-surface-2 border-border",
              falhou && "border-danger/40"
            )}
          >
            {doUsuario ? message.content : <Markdown content={message.content} />}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
