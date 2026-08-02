"use client";

import { useEffect, useRef, useState } from "react";
import ErrorBanner from "@/components/molecules/ErrorBanner";
import BoardColumn from "@/components/organisms/BoardColumn";
import BoardHeader from "@/components/organisms/BoardHeader";
import CardDrawer from "@/components/organisms/CardDrawer";
import KanbanCard from "@/components/organisms/KanbanCard";
import ProjectsDialog from "@/components/organisms/ProjectsDialog";
import BoardTemplate from "@/components/templates/BoardTemplate";
import type { Board } from "@/lib/config";
import { pedirJson } from "@/lib/http";

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
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  // O envio da mensagem é assíncrono e a caixa de chat é uma só pro board
  // inteiro: sem saber qual card está na tela agora, o restore do rascunho
  // devolveria o texto do card errado.
  const cardNaTela = useRef<string | null>(null);
  useEffect(() => {
    cardNaTela.current = open;
  }, [open]);

  // Rota de saída do drawer pelo teclado: sem isso o único jeito de fechar é
  // achar o botão no canto.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

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
          : (snapshot.projects[0]?.id ?? "")
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

  if (!board) return <div className="p-6">Carregando…</div>;

  const cardsIn = (colunaId: string) => board.cards.filter((card) => card.columnId === colunaId);

  // Deriva do board em vez de confiar no state: se o projeto escolhido foi
  // excluído, o seletor mostra a primeira opção enquanto o state ainda aponta
  // pro id morto — e o card iria pro servidor com um projeto inexistente.
  const projetoSelecionado =
    board.projects.find((projeto) => projeto.id === projectId) ?? board.projects[0];

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

  // Fora do chat um cancelamento joga fora minutos de implementação, por isso a
  // confirmação; no chat o botão só vale se for instantâneo.
  async function cancelarOperacao(id: string, confirmar: boolean) {
    const aviso =
      "Um agente está atuando neste card.\n\n" +
      "Cancelar interrompe a execução agora. O que já foi commitado na worktree fica. Continuar?";
    if (confirmar && !window.confirm(aviso)) return;

    setCancelandoId(id);
    const resultado = await pedirJson(`/api/cards/${id}/cancel`, { method: "POST" });
    setCancelandoId((atual) => (atual === id ? null : atual));

    if (!resultado.ok) setErro(resultado.erro ?? "não foi possível cancelar a operação");
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
    if (resultado.ok) return;

    setErro(resultado.erro ?? "não foi possível enviar a mensagem");
    if (cardNaTela.current !== id) return;
    setChatInput((rascunho) => (rascunho === "" ? texto : rascunho));
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
    : undefined;

  return (
    <BoardTemplate
      header={
        <BoardHeader
          live={live}
          title={title}
          onTitleChange={setTitle}
          projects={board.projects}
          selectedProjectId={projetoSelecionado?.id ?? ""}
          onProjectChange={setProjectId}
          onSubmit={addCard}
          onOpenProjects={() => setProjectsOpen(true)}
        />
      }
      aviso={erro && <ErrorBanner message={erro} onDismiss={() => setErro(null)} />}
      modais={
        <ProjectsDialog board={board} open={projectsOpen} onOpenChange={setProjectsOpen} />
      }
      colunas={board.columns.map((col) => (
        <BoardColumn
          key={col.id}
          col={col}
          vazia={cardsIn(col.id).length === 0}
          arrastando={dragOver === col.id}
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
          {cardsIn(col.id).map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              column={col}
              project={board.projects.find((projeto) => projeto.id === card.projectId)}
              cancelando={cancelandoId === card.id}
              onOpen={() => setOpen(card.id)}
              onRemove={() => removeCard(card.id)}
              onCancel={() => cancelarOperacao(card.id, !col.chat)}
              onRun={() => runNow(card.id)}
              onDragStart={() => setDragId(card.id)}
            />
          ))}
        </BoardColumn>
      ))}
      drawer={
        openCard && (
          <CardDrawer
            card={openCard}
            column={openCol}
            columns={board.columns}
            cancelando={cancelandoId === openCard.id}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onClose={() => setOpen(null)}
            onCancel={(confirmar) => cancelarOperacao(openCard.id, confirmar)}
            onRemove={() => removeCard(openCard.id)}
            onSendChat={() => sendChat(openCard.id)}
          />
        )
      }
    />
  );
}
