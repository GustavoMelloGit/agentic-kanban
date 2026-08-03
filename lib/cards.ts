import type { Card } from "./config";
import { textoNaoVazio } from "./texto";

export type CardFields = Partial<Pick<Card, "title" | "description">>;
export type NewCardFields = {
  title: string;
  description?: string;
  projectId?: string;
  columnId?: string;
};

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

// Ausente é legítimo — o store tem padrão pros dois. Mas um valor que não é
// texto cairia nesse padrão calado: o card iria pro repo errado, ou pra uma
// coluna que não é a que o humano escolheu.
function validarTextoOpcional<Campo extends string>(
  corpo: Record<string, unknown>,
  campo: Campo,
  erro: string
): { error: string } | Partial<Record<Campo, string>> {
  if (corpo[campo] === undefined) return {};
  const texto = textoNaoVazio(corpo[campo]);
  if (!texto) return { error: erro };
  return { [campo]: texto } as Record<Campo, string>;
}

export function validateNewCard(body: unknown): Validated<NewCardFields> {
  const corpo = comoObjeto(body);
  if (!corpo) return { error: "o corpo deve ser um objeto" };

  const titulo = validarTitulo(corpo.title);
  if ("error" in titulo) return titulo;

  const descricao = validarDescricao(corpo);
  if ("error" in descricao) return descricao;

  const projeto = validarTextoOpcional(corpo, "projectId", "projeto é obrigatório");
  if ("error" in projeto) return projeto;

  const coluna = validarTextoOpcional(corpo, "columnId", "coluna é obrigatória");
  if ("error" in coluna) return coluna;

  return { fields: { ...titulo, ...descricao, ...projeto, ...coluna } };
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
