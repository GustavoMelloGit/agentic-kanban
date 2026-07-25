"use client";

import { useEffect, useState } from "react";
import { MAX_REVIEW_CYCLES, parseVerdict, type Board } from "../lib/config";

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [chatInput, setChatInput] = useState("");

  // Live board via SSE: server pushes a fresh snapshot on every change.
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      const data: Board = JSON.parse(e.data);
      setBoard(data);
      setProjectId((cur) => cur || data.projects[0]?.id || "");
    };
    return () => es.close();
  }, []);

  if (!board) return <div style={{ padding: 24 }}>Carregando…</div>;

  const cardsIn = (colId: string) => board.cards.filter((c) => c.columnId === colId);

  async function move(id: string, toColumnId: string) {
    const card = board!.cards.find((c) => c.id === id);
    if (card && card.columnId === toColumnId) return;
    if (card && card.status === "running") {
      const ok = window.confirm(
        "Um agente está atuando neste card.\n\nMover irá CANCELAR a execução atual. Continuar?"
      );
      if (!ok) return;
    }
    // optimistic; SSE will reconcile
    setBoard((b) =>
      b ? { ...b, cards: b.cards.map((c) => (c.id === id ? { ...c, columnId: toColumnId } : c)) } : b
    );
    await fetch(`/api/cards/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ toColumnId }),
    });
  }

  async function runNow(id: string) {
    await fetch(`/api/cards/${id}/run`, { method: "POST" });
  }

  async function removeCard(id: string) {
    const card = board!.cards.find((c) => c.id === id);
    if (!card) return;
    const warn =
      card.status === "running"
        ? "Um agente está atuando neste card.\n\nExcluir irá CANCELAR a execução e apagar o card, seu histórico e sua conversa. Continuar?"
        : `Excluir "${card.title}"?\n\nO histórico do agente e a conversa vão junto. Não tem como desfazer.`;
    if (!window.confirm(warn)) return;
    // optimistic; SSE will reconcile
    setBoard((b) => (b ? { ...b, cards: b.cards.filter((c) => c.id !== id) } : b));
    setOpen((o) => (o === id ? null : o));
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
  }

  async function sendChat(id: string) {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    await fetch(`/api/cards/${id}/message`, { method: "POST", body: JSON.stringify({ text }) });
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/cards", { method: "POST", body: JSON.stringify({ title, projectId }) });
    setTitle("");
  }

  const openCard = board.cards.find((c) => c.id === open);
  const openCol = openCard ? board.columns.find((c) => c.id === openCard.columnId) : null;

  return (
    <>
      <header>
        <h1>Agentic Kanban</h1>
        <span className="hint">solte um card numa coluna auto → o agente atua</span>
        <form className="new-card" onSubmit={addCard}>
          <input
            placeholder="Nova ideia…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 200 }}
          />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {board.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.tool}
              </option>
            ))}
          </select>
          <button type="submit">Adicionar</button>
        </form>
      </header>

      <div className="board">
        {board.columns.map((col) => (
          <div
            key={col.id}
            className={`column ${dragOver === col.id ? "dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
            onDrop={() => {
              setDragOver(null);
              if (dragId) move(dragId, col.id);
              setDragId(null);
            }}
          >
            <h2>
              {col.name}
              <span className={`tag ${col.type !== "manual" ? "auto" : ""}`}>
                {col.type === "autonomous"
                  ? `⚡ autonomous → ${col.onComplete || "—"}${
                      col.onReject ? ` · ↩ ${col.onReject}` : ""
                    }`
                  : col.type === "automated"
                  ? "🤖 automated (fica)"
                  : "manual"}
              </span>
            </h2>

            {cardsIn(col.id).map((card) => {
              const project = board.projects.find((p) => p.id === card.projectId);
              return (
                <div
                  key={card.id}
                  className="card"
                  draggable
                  onDragStart={() => setDragId(card.id)}
                  onClick={() => setOpen(card.id)}
                >
                  <div className="title">
                    <span>{card.title}</span>
                    <button
                      className="ghost remove"
                      title="Excluir card"
                      aria-label={`Excluir ${card.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCard(card.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  {card.description && <div className="desc">{card.description}</div>}
                  <div className="meta">
                    <span className="badge project">
                      {project?.name} · {project?.tool}
                    </span>
                    <span className={`badge status-${card.status}`}>
                      {card.status === "running" && <span className="spinner">◐</span>} {card.status}
                    </span>
                    {card.reviewCycles > 0 && (
                      <span
                        className="badge verdict-rejected"
                        title={`Review devolveu o card ${card.reviewCycles}x (limite ${MAX_REVIEW_CYCLES})`}
                      >
                        ↩ {card.reviewCycles}/{MAX_REVIEW_CYCLES}
                      </span>
                    )}
                  </div>
                  {col.type !== "manual" && !col.chat && card.status !== "running" && (
                    <div className="actions">
                      <button
                        className="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          runNow(card.id);
                        }}
                      >
                        Rodar agente de novo
                      </button>
                    </div>
                  )}
                  {col.chat && card.messages.length > 0 && (
                    <div className="meta">
                      <span className="badge">💬 {card.messages.length}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {openCard && (
        <div className="drawer">
          <button className="close ghost" onClick={() => setOpen(null)}>
            fechar
          </button>
          <h3>{openCard.title}</h3>
          <p className="desc">{openCard.description}</p>
          <p>
            <button className="ghost danger" onClick={() => removeCard(openCard.id)}>
              Excluir card
            </button>
          </p>

          {openCol?.chat ? (
            <div className="chat">
              <div className="chat-thread">
                {openCard.messages.length === 0 && openCard.status !== "running" && (
                  <p className="hint">A conversa começa quando o card chega aqui.</p>
                )}
                {openCard.messages.map((m, i) => (
                  <div key={i} className={`msg msg-${m.role}`}>
                    <div className="msg-role">{m.role === "user" ? "Você" : "Agente"}</div>
                    <div className="msg-body">{m.content}</div>
                  </div>
                ))}
                {openCard.status === "running" && (
                  <div className="msg msg-agent">
                    <div className="msg-role">Agente</div>
                    <div className="msg-body hint">
                      <span className="spinner">◐</span> pensando…
                    </div>
                  </div>
                )}
              </div>
              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat(openCard.id);
                }}
              >
                <input
                  placeholder={openCard.status === "running" ? "Aguarde a resposta…" : "Responda ao agente…"}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={openCard.status === "running"}
                />
                <button type="submit" disabled={openCard.status === "running"}>
                  Enviar
                </button>
              </form>
            </div>
          ) : (
            <>
              <h4>Histórico do agente ({openCard.history.length})</h4>
              {openCard.history.length === 0 && <p className="hint">Nenhuma execução ainda.</p>}
              {openCard.history
                .slice()
                .reverse()
                .map((h, i) => {
                  const isVerdictCol = board.columns.find((c) => c.id === h.column)?.verdict;
                  const verdict = isVerdictCol ? parseVerdict(h.output) : null;
                  return (
                    <details className="entry" key={i} open={i === 0}>
                      <summary>
                        <b>{h.column}</b>
                        {verdict && (
                          <span
                            className={`badge ${
                              verdict === "APPROVE" ? "verdict-approved" : "verdict-rejected"
                            }`}
                          >
                            {verdict === "APPROVE" ? "✓ APPROVE" : "↩ CHANGES_REQUESTED"}
                          </span>
                        )}
                        <span className="hint">
                          {h.tool} · {h.ok ? "ok" : "erro"} · {h.at}
                        </span>
                      </summary>
                      <pre>{h.output}</pre>
                    </details>
                  );
                })}
            </>
          )}
        </div>
      )}
    </>
  );
}
