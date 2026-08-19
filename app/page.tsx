"use client";

import { useEffect, useRef, useState } from "react";
import CardComposer from "@/components/molecules/CardComposer";
import ErrorBanner from "@/components/molecules/ErrorBanner";
import BoardColumn from "@/components/organisms/BoardColumn";
import BoardHeader from "@/components/organisms/BoardHeader";
import CardDrawer from "@/components/organisms/CardDrawer";
import KanbanCard from "@/components/organisms/KanbanCard";
import ProjectsDialog from "@/components/organisms/ProjectsDialog";
import BoardTemplate from "@/components/templates/BoardTemplate";
import { triarAnexos } from "@/lib/anexos";
import type { Board, Card } from "@/lib/config";
import { pedirJson } from "@/lib/http";

type CardDraft = Pick<Card, "title" | "description">;
// O rascunho carrega o dono: resetar por efeito ao trocar de card só roda depois
// do paint, e o drawer do card novo pisca com o texto do anterior.
type CardDraftDono = CardDraft & { cardId: string };

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // coluna com o compositor aberto — só um por vez, como no Notion
  const [compondoEm, setCompondoEm] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [criando, setCriando] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatArquivos, setChatArquivos] = useState<File[]>([]);
  const [erroDoAnexoDoChat, setErroDoAnexoDoChat] = useState<string | null>(null);
  const [erroDoAnexoDoCard, setErroDoAnexoDoCard] = useState<string | null>(null);
  const [anexandoNoCard, setAnexandoNoCard] = useState(false);
  const [removendoAnexoId, setRemovendoAnexoId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraftDono | null>(null);
  const [erroDaEdicao, setErroDaEdicao] = useState<string | null>(null);
  const [salvandoCard, setSalvandoCard] = useState(false);
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

  // O erro é do card que estava aberto; abrir outro começa limpo. Os arquivos
  // pendentes vão junto: eles ainda não foram enviados, e mandá-los pro card
  // seguinte seria anexar no lugar errado.
  useEffect(() => {
    setErroDaEdicao(null);
    setChatArquivos([]);
    setErroDoAnexoDoChat(null);
    setErroDoAnexoDoCard(null);
  }, [open]);

  // Rota de saída do drawer pelo teclado: sem isso o único jeito de fechar é
  // achar o botão no canto. O compositor trata o próprio Esc e não chega aqui.
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

  const draftDoCard = (card: Card): CardDraft =>
    cardDraft?.cardId === card.id
      ? cardDraft
      : { title: card.title, description: card.description };

  const edicaoSuja = (card: Card) => {
    const draft = draftDoCard(card);
    return draft.title !== card.title || draft.description !== card.description;
  };

  function editarCard(card: Card, patch: Partial<CardDraft>) {
    setCardDraft({ ...draftDoCard(card), ...patch, cardId: card.id });
  }

  async function salvarCard(card: Card) {
    const { title: tituloEditado, description: descricaoEditada } = draftDoCard(card);
    if (!tituloEditado.trim()) {
      setErroDaEdicao("Escreva um título pro card.");
      return;
    }

    setSalvandoCard(true);
    setErroDaEdicao(null);
    const resultado = await pedirJson(`/api/cards/${card.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: tituloEditado, description: descricaoEditada }),
    });
    setSalvandoCard(false);

    if (!resultado.ok) {
      // o drawer pode ter trocado de card durante o PATCH: o erro é do card que
      // foi salvo, não do que está na tela agora
      if (cardNaTela.current === card.id) {
        setErroDaEdicao(resultado.erro ?? "não foi possível salvar o card");
      }
      return;
    }
    setCardDraft((atual) => (atual?.cardId === card.id ? null : atual));
  }

  // Mensagem só com anexo é envio válido: o arquivo é o recado. Vai como
  // multipart pra mensagem e arquivos nascerem no mesmo passo — mensagem sem os
  // anexos dela seria registro incompleto da conversa.
  async function sendChat(id: string) {
    const texto = chatInput.trim();
    const arquivos = chatArquivos;
    if (!texto && arquivos.length === 0) return;

    setChatInput("");
    setChatArquivos([]);
    setErroDoAnexoDoChat(null);

    const envio = new FormData();
    envio.append("text", texto);
    for (const arquivo of arquivos) envio.append("files", arquivo);

    const resultado = await pedirJson(`/api/cards/${id}/message`, {
      method: "POST",
      body: envio,
    });
    if (resultado.ok) return;

    setErro(resultado.erro ?? "não foi possível enviar a mensagem");
    if (cardNaTela.current !== id) return;
    setChatInput((rascunho) => (rascunho === "" ? texto : rascunho));
    setChatArquivos((pendentes) => (pendentes.length === 0 ? arquivos : pendentes));
  }

  // Recusa na hora, antes de qualquer requisição: arquivo grande demais precisa
  // aparecer como aviso no compositor, não sumir calado. O que passa é anexado
  // mesmo assim — um arquivo recusado não derruba os válidos do mesmo lote.
  function anexarNoChat(novos: File[]) {
    const { aceitos, recusa } = triarAnexos(chatArquivos.length, novos);
    setErroDoAnexoDoChat(recusa);
    if (aceitos.length > 0) setChatArquivos((pendentes) => [...pendentes, ...aceitos]);
  }

  function removerAnexoDoChat(indice: number) {
    setErroDoAnexoDoChat(null);
    setChatArquivos((pendentes) => pendentes.filter((_, posicao) => posicao !== indice));
  }

  async function anexarNoCard(id: string, novos: File[]) {
    const { aceitos, recusa } = triarAnexos(0, novos);
    setErroDoAnexoDoCard(recusa);
    if (aceitos.length === 0) return;

    setAnexandoNoCard(true);

    const envio = new FormData();
    for (const arquivo of aceitos) envio.append("files", arquivo);

    const resultado = await pedirJson(`/api/cards/${id}/attachments`, {
      method: "POST",
      body: envio,
    });
    setAnexandoNoCard(false);

    if (!resultado.ok && cardNaTela.current === id) {
      setErroDoAnexoDoCard(resultado.erro ?? "não foi possível anexar o arquivo");
    }
  }

  async function removerAnexoDoCard(anexoId: string) {
    setErroDoAnexoDoCard(null);
    setRemovendoAnexoId(anexoId);
    const resultado = await pedirJson(`/api/attachments/${anexoId}`, { method: "DELETE" });
    setRemovendoAnexoId((atual) => (atual === anexoId ? null : atual));

    if (!resultado.ok) setErro(resultado.erro ?? "não foi possível remover o anexo");
  }

  function abrirCompositor(columnId: string) {
    setErro(null);
    setTitle("");
    setCompondoEm(columnId);
  }

  function fecharCompositor() {
    setCompondoEm(null);
    setTitle("");
  }

  // O compositor continua aberto e vazio depois de criar: adicionar vários
  // cards seguidos é o caso comum, e reabrir a cada card custaria um clique.
  async function addCard(columnId: string) {
    const texto = title.trim();
    if (!texto || criando) return;

    const projetoDestino = projetoSelecionado?.id;
    if (!projetoDestino) {
      setErro("Cadastre um projeto antes (botão Projetos).");
      return;
    }

    setCriando(true);
    const resultado = await pedirJson("/api/cards", {
      method: "POST",
      body: JSON.stringify({ title: texto, projectId: projetoDestino, columnId }),
    });
    setCriando(false);

    if (!resultado.ok) {
      // mantém o texto no campo: perder o que foi digitado por causa de uma
      // falha de rede é pior que a mensagem de erro
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
          totalDeProjetos={board.projects.length}
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
          columns={board.columns}
          vazia={cardsIn(col.id).length === 0}
          arrastando={dragOver === col.id}
          podeAdicionar={board.projects.length > 0}
          onAdd={() => abrirCompositor(col.id)}
          compositor={
            compondoEm === col.id ? (
              <CardComposer
                column={col}
                projects={board.projects}
                projectId={projetoSelecionado?.id ?? ""}
                onProjectChange={setProjectId}
                value={title}
                onChange={setTitle}
                onSubmit={() => addCard(col.id)}
                onCancel={fecharCompositor}
                ocupado={criando}
              />
            ) : undefined
          }
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
            chatArquivos={chatArquivos}
            erroDoAnexoDoChat={erroDoAnexoDoChat}
            onAnexarNoChat={anexarNoChat}
            onRemoverAnexoDoChat={removerAnexoDoChat}
            erroDoAnexoDoCard={erroDoAnexoDoCard}
            anexandoNoCard={anexandoNoCard}
            removendoAnexoId={removendoAnexoId}
            onAnexarNoCard={(arquivos) => anexarNoCard(openCard.id, arquivos)}
            onRemoverAnexoDoCard={removerAnexoDoCard}
            draft={draftDoCard(openCard)}
            suja={edicaoSuja(openCard)}
            salvando={salvandoCard}
            erroDaEdicao={erroDaEdicao}
            onDraftChange={(patch) => editarCard(openCard, patch)}
            onSalvar={() => salvarCard(openCard)}
            onDescartar={() => setCardDraft(null)}
            onClose={() => setOpen(null)}
            onCancel={(confirmar) => cancelarOperacao(openCard.id, confirmar)}
            onRemove={() => removeCard(openCard.id)}
            onRun={() => runNow(openCard.id)}
            onSendChat={() => sendChat(openCard.id)}
          />
        )
      }
    />
  );
}
