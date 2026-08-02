import type { Card } from "./config";
import { textoNaoVazio } from "./texto";

export type CardFields = Partial<Pick<Card, "title" | "description">>;

export type Validated = { error: string } | { fields: CardFields };

// `parcial: true` (PATCH) valida só os campos presentes; false (POST) exige o título.
export function validateCard(body: Record<string, unknown>, parcial: boolean): Validated {
  // A worktree do card mora dentro do repo do workspace do projeto, e a remoção
  // usa o projeto que o card tem na hora: trocar deixaria a worktree órfã.
  if (parcial && body.projectId !== undefined) {
    return { error: "o projeto de um card não pode ser alterado" };
  }

  const fields: CardFields = {};

  if (body.title !== undefined || !parcial) {
    const titulo = textoNaoVazio(body.title);
    if (!titulo) return { error: "título é obrigatório" };
    fields.title = titulo;
  }

  // Descrição vazia é válida: é assim que todo card nasce hoje.
  if (body.description !== undefined) {
    if (typeof body.description !== "string") return { error: "descrição deve ser texto" };
    fields.description = body.description.trim();
  }

  return { fields };
}
