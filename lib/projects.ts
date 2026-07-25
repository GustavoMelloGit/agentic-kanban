import { TOOLS, type Project } from "./config";
import { ensureWorkspaceDir } from "./runner";
import { logErro } from "./log";

export type ProjectFields = Partial<Omit<Project, "id">>;

export type Validated = { error: string } | { fields: ProjectFields };

// `parcial: true` (PATCH) valida só os campos presentes; false (POST) exige os três.
export function validateProject(body: Record<string, unknown>, parcial: boolean): Validated {
  const fields: ProjectFields = {};

  if (body.name !== undefined || !parcial) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "nome é obrigatório" };
    fields.name = body.name.trim();
  }

  if (body.tool !== undefined || !parcial) {
    if (typeof body.tool !== "string" || !(body.tool in TOOLS)) {
      return { error: `ferramenta inválida (use: ${Object.keys(TOOLS).join(", ")})` };
    }
    fields.tool = body.tool;
  }

  if (body.workspace !== undefined || !parcial) {
    if (typeof body.workspace !== "string" || !body.workspace.trim()) {
      return { error: "workspace é obrigatório" };
    }
    const workspace = body.workspace.trim();
    try {
      ensureWorkspaceDir(workspace);
    } catch (erro) {
      logErro(`criação do workspace ${workspace}`, erro);
      return { error: (erro as Error).message };
    }
    fields.workspace = workspace;
  }

  return { fields };
}
