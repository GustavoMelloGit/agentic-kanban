import ConnectionStatus from "@/components/molecules/ConnectionStatus";
import NewCardForm from "@/components/molecules/NewCardForm";
import type { Project } from "@/lib/config";

export default function BoardHeader({
  live,
  ...formulario
}: {
  live: boolean;
  title: string;
  onTitleChange: (texto: string) => void;
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  onSubmit: (evento: React.FormEvent) => void;
  onOpenProjects: () => void;
}) {
  return (
    // z acima do drawer: senão o drawer (fixed, altura total) cobre o form de
    // adicionar card e engole os cliques
    <header className="bg-background relative z-30 flex h-(--header-h) items-center gap-4 border-b px-6">
      <h1 className="text-base font-semibold tracking-[-0.01em]">Agentic Kanban</h1>
      <span className="text-muted-foreground hidden text-xs xl:inline">
        solte um card numa coluna auto → o agente atua
      </span>
      <ConnectionStatus live={live} />
      <NewCardForm {...formulario} />
    </header>
  );
}
