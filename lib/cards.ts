import type { Card } from "./config";
import { textoNaoVazio } from "./texto";

export type CardFields = Partial<Pick<Card, "title" | "description">>;
export type NewCardFields = { title: string; description?: string; projectId?: string };

export type Validated<T> = { error: string } | { fields: T };

const CAMPOS_EDITAVEIS = new Set(["title", "description"]);

function comoObjeto(body: unknown): Record<string, unknown> | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function validarTitulo(valor: unknown): { error: string } | { title: string } {
  const title = textoNaoVazio(valor);
  if (!title) return { error: "título é obrigatório" };
  return { title };
}

// Descrição vazia é válida: é assim que todo card nasce hoje.
function validarDescricao(corpo: Record<string, unknown>): { error: string } | { description?: string } {
  if (corpo.description === undefined) return {};
  if (typeof corpo.description !== "string") return { error: "descrição deve ser texto" };
  return { description: corpo.description.trim() };
}

// O projeto define tool e workspace: um valor que não é texto apontaria o agente
// pro repo errado se virasse o projeto padrão calado.
function validarProjeto(corpo: Record<string, unknown>): { error: string } | { projectId?: string } {
  if (corpo.projectId === undefined) return {};
  const projectId = textoNaoVazio(corpo.projectId);
  if (!projectId) return { error: "projeto é obrigatório" };
  return { projectId };
}

export function validateNewCard(body: unknown): Validated<NewCardFields> {
  const corpo = comoObjeto(body);
  if (!corpo) return { error: "o corpo deve ser um objeto" };

  const titulo = validarTitulo(corpo.title);
  if ("error" in titulo) return titulo;

  const descricao = validarDescricao(corpo);
  if ("error" in descricao) return descricao;

  const projeto = validarProjeto(corpo);
  if ("error" in projeto) return projeto;

  return { fields: { ...titulo, ...descricao, ...projeto } };
}

export function validateCardPatch(body: unknown): Validated<CardFields> {
  const corpo = comoObjeto(body);
  if (!corpo) return { error: "o corpo deve ser um objeto" };

  // A worktree do card mora dentro do repo do workspace do projeto, e a remoção
  // usa o projeto que o card tem na hora: trocar deixaria a worktree órfã.
  if (corpo.projectId !== undefined) {
    return { error: "o projeto de um card não pode ser alterado" };
  }

  // Coluna, status e ciclos de review são do motor. Recusar em vez de ignorar:
  // um 200 calado faz o cliente acreditar que a escrita valeu.
  const naoEditavel = Object.keys(corpo).find((campo) => !CAMPOS_EDITAVEIS.has(campo));
  if (naoEditavel) return { error: `campo não editável: ${naoEditavel}` };

  const fields: CardFields = {};

  if (corpo.title !== undefined) {
    const titulo = validarTitulo(corpo.title);
    if ("error" in titulo) return titulo;
    fields.title = titulo.title;
  }

  const descricao = validarDescricao(corpo);
  if ("error" in descricao) return descricao;

  return { fields: { ...fields, ...descricao } };
}
