import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/lib/config";

export default function NewCardForm({
  title,
  onTitleChange,
  projects,
  selectedProjectId,
  onProjectChange,
  onSubmit,
  onOpenProjects,
}: {
  title: string;
  onTitleChange: (texto: string) => void;
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  onSubmit: (evento: React.FormEvent) => void;
  onOpenProjects: () => void;
}) {
  const semProjeto = projects.length === 0;

  return (
    <form className="ml-auto flex items-center gap-2" onSubmit={onSubmit}>
      <Input
        aria-label="Título do novo card"
        placeholder="Nova ideia…"
        value={title}
        onChange={(evento) => onTitleChange(evento.target.value)}
        disabled={semProjeto}
        className="w-50"
      />

      <Select value={selectedProjectId} onValueChange={onProjectChange} disabled={semProjeto}>
        <SelectTrigger aria-label="Projeto do card" className="w-56">
          <SelectValue placeholder="sem projeto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((projeto) => (
            <SelectItem key={projeto.id} value={projeto.id}>
              {projeto.name} · {projeto.tool}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" disabled={semProjeto}>
        Adicionar
      </Button>
      <Button type="button" variant="outline" onClick={onOpenProjects}>
        Projetos ({projects.length})
      </Button>
    </form>
  );
}
