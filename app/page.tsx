"use client";

import { useEffect, useState } from "react";
import { MAX_REVIEW_CYCLES, type Board } from "../lib/config";
import { parseVerdict } from "../lib/verdict";
import { pedirJson } from "../lib/http";
import ChatThread from "./ChatThread";
import ProjectsPanel from "./ProjectsPanel";

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  // Live board via SSE: server pushes a fresh snapshot on every change.
  // Se a conexão cai (restart do dev server, sleep da máquina), o board da aba
  // congela e a UI fica mentindo — daí o indicador + reconexão + refetch.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let desmontado = false;

    const aplicar = (snapshot: Board) => {
      setBoard(snapshot);
      // mantém a seleção, mas cai pro primeiro se o projeto escolhido sumiu
      setProjectId((atual) =>
        snapshot.projects.some((projeto) => projeto.id === atual)
          ? atual
          : snapshot.projects[0]?.id ?? ""
      );
    };

    const buscar = async () => {
      const resultado = await pedirJson<Board>("/api/board");
      if (resultado.ok && resultado.dados) aplicar(resultado.dados);
    };

    const conectar = () => {
      es = new EventSource("/api/events");
      es.onopen = () => setLive(true);
      es.onmessage = (evento) => {
        setLive(true);
        aplicar(JSON.parse(evento.data));
      };
      es.onerror = () => {
        es?.close();
        if (desmontado) return;
        setLive(false);
        buscar();
        retry = setTimeout(conectar, 3000);
      };
    };

    buscar();
    conectar();
    return () => {
      desmontado = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, []);

  if (!board) return <div style={{ padding: 24 }}>Carregando…</div>;

  const cardsIn = (colunaId: string) => board.cards.filter((card) => card.columnId === colunaId);

  // Deriva do board em vez de confiar no state: se o projeto escolhido foi
  // excluído, o <select> mostra a primeira opção enquanto o state ainda aponta
  // pro id morto — e o card iria pro servidor com um projeto inexistente.
  const projetoSelecionado =
    board.projects.find((projeto) => projeto.id === projectId) ?? board.projects[0];
  const semProjeto = board.projects.length === 0;

  async function move(id: string, toColumnId: string) {
    const card = board!.cards.find((candidato) => candidato.id === id);
    if (card && card.columnId === toColumnId) return;
    if (card && card.status === "running") {
      const confirmado = window.confirm(
        "Um agente está atuando neste card.\n\nMover irá CANCELAR a execução atual. Continuar?"
      );
      if (!confirmado) return;
    }

    setBoard((atual) =>
      atual
        ? {
            ...atual,
            cards: atual.cards.map((card) =>
              card.id === id ? { ...card, columnId: toColumnId } : card
            ),
          }
        : atual
    );

    const resultado = await pedirJson(`/api/cards/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ toColumnId }),
    });
    if (!resultado.ok) setErro(resultado.erro ?? "não foi possível mover o card");
  }

  async function runNow(id: string) {
    const resultado = await pedirJson(`/api/cards/${id}/run`, { method: "POST" });
    if (!resultado.ok) setErro(resultado.erro ?? "não foi possível rodar o agente");
  }

  async function removeCard(id: string) {
    const card = board!.cards.find((candidato) => candidato.id === id);
    if (!card) return;

    const aviso =
      card.status === "running"
        ? "Um agente está atuando neste card.\n\nExcluir irá CANCELAR a execução e apagar o card, seu histórico e sua conversa. Continuar?"
        : `Excluir "${card.title}"?\n\nO histórico do agente e a conversa vão junto. Não tem como desfazer.`;
    if (!window.confirm(aviso)) return;

    setBoard((atual) =>
      atual ? { ...atual, cards: atual.cards.filter((card) => card.id !== id) } : atual
    );
    setOpen((aberto) => (aberto === id ? null : aberto));

    const resultado = await pedirJson(`/api/cards/${id}`, { method: "DELETE" });
    if (!resultado.ok) setErro(resultado.erro ?? "não foi possível excluir o card");
  }

  async function sendChat(id: string) {
    const texto = chatInput.trim();
    if (!texto) return;
    setChatInput("");

    const resultado = await pedirJson(`/api/cards/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ text: texto }),
    });
    if (!resultado.ok) {
      setChatInput(texto);
      setErro(resultado.erro ?? "não foi possível enviar a mensagem");
    }
  }

  async function addCard(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (!title.trim()) {
      setErro("Escreva um título pro card.");
      return;
    }

    const projetoDestino = projetoSelecionado?.id;
    if (!projetoDestino) {
      setErro("Cadastre um projeto antes (botão Projetos).");
      return;
    }

    const resultado = await pedirJson("/api/cards", {
      method: "POST",
      body: JSON.stringify({ title, projectId: projetoDestino }),
    });
    if (!resultado.ok) {
      setErro(resultado.erro ?? "não foi possível criar o card");
      return;
    }

    setProjectId(projetoDestino);
    setTitle("");
  }

  const openCard = board.cards.find((card) => card.id === open);
  const openCol = openCard
    ? board.columns.find((coluna) => coluna.id === openCard.columnId)
    : null;

  return (
    <>
      <header>
        <h1>Agentic Kanban</h1>
        <span className="hint">solte um card numa coluna auto → o agente atua</span>
        {!live && (
          <span className="badge status-error" title="o board pode estar desatualizado">
            ⚠ desconectado — reconectando…
          </span>
        )}
        <form className="new-card" onSubmit={addCard}>
          <input
            placeholder="Nova ideia…"
            value={title}
            onChange={(evento) => setTitle(evento.target.value)}
            style={{ width: 200 }}
            disabled={semProjeto}
          />
          <select
            value={projetoSelecionado?.id ?? ""}
            onChange={(evento) => setProjectId(evento.target.value)}
            disabled={semProjeto}
          >
            {semProjeto && <option value="">sem projeto</option>}
            {board.projects.map((projeto) => (
              <option key={projeto.id} value={projeto.id}>
                {projeto.name} · {projeto.tool}
              </option>
            ))}
          </select>
          <button type="submit" disabled={semProjeto}>
            Adicionar
          </button>
          <button type="button" className="ghost" onClick={() => setProjectsOpen(true)}>
            Projetos ({board.projects.length})
          </button>
        </form>
      </header>

      {erro && (
        <p className="top-error" onClick={() => setErro(null)} title="clique pra fechar">
          ⚠ {erro}
        </p>
      )}

      {projectsOpen && <ProjectsPanel board={board} onClose={() => setProjectsOpen(false)} />}

      <div className="board">
        {board.columns.map((col) => (
          <div
            key={col.id}
            className={`column ${dragOver === col.id ? "dragover" : ""}`}
            onDragOver={(evento) => {
              evento.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver((atual) => (atual === col.id ? null : atual))}
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
              const project = board.projects.find((projeto) => projeto.id === card.projectId);
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
                      onClick={(evento) => {
                        evento.stopPropagation();
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
                        onClick={(evento) => {
                          evento.stopPropagation();
                          runNow(card.id);
                        }}
                      >
                        Rodar agente de novo
                      </button>
                    </div>
                  )}
                  {card.messages.length > 0 && (
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

          {openCol?.chat && (
            <div className="chat">
              {openCard.messages.length === 0 && openCard.status !== "running" && (
                <p className="hint">A conversa começa quando o card chega aqui.</p>
              )}
              <ChatThread
                messages={openCard.messages}
                pensando={openCard.status === "running"}
              />
              <form
                className="chat-input"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  sendChat(openCard.id);
                }}
              >
                <input
                  placeholder={openCard.status === "running" ? "Aguarde a resposta…" : "Responda ao agente…"}
                  value={chatInput}
                  onChange={(evento) => setChatInput(evento.target.value)}
                  disabled={openCard.status === "running"}
                />
                <button type="submit" disabled={openCard.status === "running"}>
                  Enviar
                </button>
              </form>
            </div>
          )}

          {!openCol?.chat && openCard.messages.length > 0 && (
            <details className="entry chat-archive">
              <summary>
                <b>💬 Conversa</b>
                <span className="hint">{openCard.messages.length} mensagens · só leitura</span>
              </summary>
              <ChatThread messages={openCard.messages} pensando={false} />
            </details>
          )}

          {(!openCol?.chat || openCard.history.length > 0) && (
            <>
              <h4>Histórico do agente ({openCard.history.length})</h4>
              {openCard.history.length === 0 && <p className="hint">Nenhuma execução ainda.</p>}
              {openCard.history
                .slice()
                .reverse()
                .map((execucao, indice) => {
                  const colunaDeVeredito = board.columns.find(
                    (coluna) => coluna.id === execucao.column
                  )?.verdict;
                  const verdict = colunaDeVeredito ? parseVerdict(execucao.output) : null;
                  return (
                    <details className="entry" key={indice} open={indice === 0}>
                      <summary>
                        <b>{execucao.column}</b>
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
                          {execucao.tool} · {execucao.ok ? "ok" : "erro"} · {execucao.at}
                        </span>
                      </summary>
                      <pre>{execucao.output}</pre>
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
