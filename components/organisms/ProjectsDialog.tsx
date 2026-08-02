"use client";

import { useState } from "react";
import Icon from "@/components/atoms/Icon";
import ProjectRow, { type DraftDeProjeto } from "@/components/molecules/ProjectRow";
import WorkspaceField from "@/components/molecules/WorkspaceField";
import DirPicker from "@/components/organisms/DirPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Board, Project } from "@/lib/config";
import { pedirJson } from "@/lib/http";

const NOVO = "__novo__"; // chave do seletor de pasta pro form de criação

export default function ProjectsDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board;
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const tools = Object.entries(board.tools);
  const ferramentaPadrao = tools[0]?.[0] ?? "claude";
  const [drafts, setDrafts] = useState<Record<string, DraftDeProjeto>>({});
  const [novo, setNovo] = useState<DraftDeProjeto>({
    name: "",
    tool: ferramentaPadrao,
    workspace: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const cardsDo = (id: string) => board.cards.filter((card) => card.projectId === id).length;

  const draftDe = (projeto: Project): DraftDeProjeto =>
    drafts[projeto.id] ?? {
      name: projeto.name,
      tool: projeto.tool,
      workspace: projeto.workspace,
    };

  const sujo = (projeto: Project) => {
    const draft = drafts[projeto.id];
    return (
      !!draft &&
      (draft.name !== projeto.name ||
        draft.tool !== projeto.tool ||
        draft.workspace !== projeto.workspace)
    );
  };

  function editar(projeto: Project, patch: Partial<DraftDeProjeto>) {
    setDrafts((atuais) => ({ ...atuais, [projeto.id]: { ...draftDe(projeto), ...patch } }));
  }

  async function chamar(url: string, init: RequestInit): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const resultado = await pedirJson(url, init);
      if (!resultado.ok) setErro(resultado.erro ?? "a operação falhou");
      return resultado.ok;
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(projeto: Project) {
    const salvou = await chamar(`/api/projects/${projeto.id}`, {
      method: "PATCH",
      body: JSON.stringify(draftDe(projeto)),
    });
    if (!salvou) return;

    setDrafts((atuais) => {
      const semEsse = { ...atuais };
      delete semEsse[projeto.id];
      return semEsse;
    });
  }

  async function excluir(projeto: Project) {
    const totalDeCards = cardsDo(projeto.id);
    if (totalDeCards > 0) {
      setErro(`"${projeto.name}" ainda tem ${totalDeCards} card(s); mova ou exclua eles primeiro.`);
      return;
    }

    const confirmado = window.confirm(
      `Excluir o projeto "${projeto.name}"?\n\nO workspace no disco não é apagado.`
    );
    if (!confirmado) return;

    await chamar(`/api/projects/${projeto.id}`, { method: "DELETE" });
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    const criou = await chamar("/api/projects", { method: "POST", body: JSON.stringify(novo) });
    if (criou) setNovo({ name: "", tool: ferramentaPadrao, workspace: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Projetos</DialogTitle>
          <DialogDescription>
            Cada card pertence a um projeto, que define qual CLI roda e em qual diretório.
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <p role="alert" className="text-danger flex items-center gap-2 text-xs">
            <Icon name="alerta" size="md" />
            {erro}
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-faint text-[11px] tracking-[0.06em] uppercase">
                <th className="px-2 pb-2 text-left font-medium">Nome</th>
                <th className="px-2 pb-2 text-left font-medium">Ferramenta</th>
                <th className="px-2 pb-2 text-left font-medium">Workspace</th>
                <th className="px-2 pb-2 text-left font-medium">Cards</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {board.projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-2 py-3 text-xs">
                    Nenhum projeto ainda — cadastre um abaixo.
                  </td>
                </tr>
              )}
              {board.projects.map((projeto) => (
                <ProjectRow
                  key={projeto.id}
                  project={projeto}
                  draft={draftDe(projeto)}
                  tools={tools}
                  totalDeCards={cardsDo(projeto.id)}
                  sujo={sujo(projeto)}
                  ocupado={ocupado}
                  escolhendoPasta={picking === projeto.id}
                  onEdit={(patch) => editar(projeto, patch)}
                  onTogglePicker={() =>
                    setPicking(picking === projeto.id ? null : projeto.id)
                  }
                  onSave={() => salvar(projeto)}
                  onDelete={() => excluir(projeto)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <form className="border-t pt-4" onSubmit={criar}>
          <h4 className="text-muted-foreground mb-2 text-[13px]">Novo projeto</h4>
          <div className="grid grid-cols-[1fr_140px_1.4fr_auto] gap-2">
            <Input
              aria-label="Nome do novo projeto"
              placeholder="Nome"
              value={novo.name}
              onChange={(evento) => setNovo({ ...novo, name: evento.target.value })}
              className="h-8 text-xs"
            />
            <Select value={novo.tool} onValueChange={(tool) => setNovo({ ...novo, tool })}>
              <SelectTrigger aria-label="Ferramenta do novo projeto" className="h-8 text-xs">
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
            <WorkspaceField
              value={novo.workspace}
              onChange={(workspace) => setNovo((atual) => ({ ...atual, workspace }))}
              onTogglePicker={() => setPicking(picking === NOVO ? null : NOVO)}
              label="Workspace do novo projeto"
              placeholder="ex.: workspaces/minha-empresa"
            />
            <Button
              type="submit"
              disabled={ocupado || !novo.name.trim() || !novo.workspace.trim()}
              className="h-8"
            >
              Criar
            </Button>
          </div>

          {picking === NOVO && (
            <DirPicker
              start={novo.workspace}
              onPick={(display) => {
                setNovo((atual) => ({ ...atual, workspace: display }));
                setPicking(null);
              }}
              onClose={() => setPicking(null)}
            />
          )}

          <p className="text-muted-foreground mt-2 text-[11px]">
            Dá pra digitar o caminho ou usar o botão de pasta pra navegar. O diretório é criado se
            não existir.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
