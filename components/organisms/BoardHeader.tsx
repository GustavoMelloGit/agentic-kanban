import ConnectionStatus from "@/components/molecules/ConnectionStatus";
import { Button } from "@/components/ui/button";

export default function BoardHeader({
  live,
  totalDeProjetos,
  onOpenProjects,
}: {
  live: boolean;
  totalDeProjetos: number;
  onOpenProjects: () => void;
}) {
  return (
    // z acima do drawer: senão o drawer (fixed, altura total) cobre o header e
    // engole os cliques
    <header className="bg-background relative z-30 flex h-(--header-h) items-center gap-4 border-b px-6">
      <h1 className="text-base font-semibold tracking-[-0.01em]">Agentic Kanban</h1>
      <span className="text-muted-foreground hidden text-xs xl:inline">
        adicione um card na coluna · numa coluna auto o agente atua na hora
      </span>
      <ConnectionStatus live={live} />
      <Button variant="outline" onClick={onOpenProjects} className="ml-auto">
        Projetos ({totalDeProjetos})
      </Button>
    </header>
  );
}
