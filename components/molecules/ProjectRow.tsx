import DirPicker from "@/components/organisms/DirPicker";
import WorkspaceField from "@/components/molecules/WorkspaceField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, Tool } from "@/lib/config";

export type DraftDeProjeto = Omit<Project, "id">;

export default function ProjectRow({
  project,
  draft,
  tools,
  totalDeCards,
  sujo,
  ocupado,
  escolhendoPasta,
  onEdit,
  onTogglePicker,
  onSave,
  onDelete,
}: {
  project: Project;
  draft: DraftDeProjeto;
  tools: [string, Tool][];
  totalDeCards: number;
  sujo: boolean;
  ocupado: boolean;
  escolhendoPasta: boolean;
  onEdit: (patch: Partial<DraftDeProjeto>) => void;
  onTogglePicker: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="border-t px-2 py-1 align-middle">
        <Input
          aria-label={`Nome do projeto ${project.name}`}
          value={draft.name}
          onChange={(evento) => onEdit({ name: evento.target.value })}
          className="h-8 text-xs"
        />
      </td>
      <td className="border-t px-2 py-1 align-middle">
        <Select value={draft.tool} onValueChange={(tool) => onEdit({ tool })}>
          <SelectTrigger aria-label={`Ferramenta do projeto ${project.name}`} className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tools.map(([chave, ferramenta]) => (
              <SelectItem key={chave} value={chave}>
                {ferramenta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="border-t px-2 py-1 align-middle">
        <WorkspaceField
          value={draft.workspace}
          onChange={(workspace) => onEdit({ workspace })}
          onTogglePicker={onTogglePicker}
          label={`Workspace do projeto ${project.name}`}
        />
        {escolhendoPasta && (
          <DirPicker
            start={draft.workspace}
            onPick={(display) => {
              onEdit({ workspace: display });
              onTogglePicker();
            }}
            onClose={onTogglePicker}
          />
        )}
      </td>
      <td className="border-t px-2 py-1 text-center align-middle tabular-nums">{totalDeCards}</td>
      <td className="border-t px-2 py-1 align-middle">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            disabled={!sujo || ocupado}
            onClick={onSave}
            className="h-6.5 px-2 text-[11px] whitespace-nowrap"
          >
            Salvar
          </Button>
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={onDelete}
            className="text-danger border-danger/25 hover:bg-danger/12 hover:text-danger h-6.5 px-2 text-[11px] whitespace-nowrap"
          >
            Excluir
          </Button>
        </div>
      </td>
    </tr>
  );
}
