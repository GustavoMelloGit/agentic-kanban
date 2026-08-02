"use client";

import type { ChatMessage } from "../lib/config";
import Markdown from "./Markdown";

export default function ChatThread({
  messages,
  pensando,
}: {
  messages: ChatMessage[];
  pensando: boolean;
}) {
  return (
    <div className="chat-thread">
      {messages.map((mensagem, indice) => (
        <div key={indice} className={`msg msg-${mensagem.role}`}>
          <div className="msg-role">{mensagem.role === "user" ? "Você" : "Agente"}</div>
          <div className="msg-body">
            {mensagem.role === "agent" ? <Markdown content={mensagem.content} /> : mensagem.content}
          </div>
        </div>
      ))}
      {pensando && (
        <div className="msg msg-agent">
          <div className="msg-role">Agente</div>
          <div className="msg-body hint">
            <span className="spinner">◐</span> pensando…
          </div>
        </div>
      )}
    </div>
  );
}
