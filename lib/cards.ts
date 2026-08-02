import type { Card } from "./config";
import { textoNaoVazio } from "./texto";

export type CardFields = Partial<Pick<Card, "title" | "description">>;

export type Validated = { error: string } | { fields: CardFields };

const CAMPOS_EDITAVEIS = new Set(["title", "description"]);

// `parcial: true` (PATCH) valida só os campos presentes; false (POST) exige o título.
export function validateCard(body: Record<string, unknown>, parcial: boolean): Validated {
  if (parcial) {
    if (Array.isArray(body)) return { error: "o corpo deve ser um objeto" };

    // A worktree do card mora dentro do repo do workspace do projeto, e a remoção
    // usa o projeto que o card tem na hora: trocar deixaria a worktree órfã.
    if (body.projectId !== undefined) {
      return { error: "o projeto de um card não pode ser alterado" };
    }

    // Coluna, status e ciclos de review são do motor. Recusar em vez de ignorar:
    // um 200 calado faz o cliente acreditar que a escrita valeu.
    const naoEditavel = Object.keys(body).find((campo) => !CAMPOS_EDITAVEIS.has(campo));
    if (naoEditavel) return { error: `campo não editável: ${naoEditavel}` };
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
