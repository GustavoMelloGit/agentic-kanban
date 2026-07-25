"use client";

import { useState } from "react";
import type { Board, Project } from "../lib/config";
import { pedirJson } from "../lib/http";
import DirPicker from "./DirPicker";

type Draft = Omit<Project, "id">;

const NOVO = "__novo__"; // chave do seletor de pasta pro form de criação

export default function ProjectsPanel({ board, onClose }: { board: Board; onClose: () => void }) {
  const tools = Object.entries(board.tools);
  const ferramentaPadrao = tools[0]?.[0] ?? "claude";
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [novo, setNovo] = useState<Draft>({ name: "", tool: ferramentaPadrao, workspace: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const cardsDo = (id: string) => board.cards.filter((card) => card.projectId === id).length;

  const draftDe = (projeto: Project): Draft =>
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

  function editar(projeto: Project, patch: Partial<Draft>) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(evento) => evento.stopPropagation()}>
        <button className="close ghost" onClick={onClose}>
          fechar
        </button>
        <h3>Projetos</h3>
        <p className="hint">
          Cada card pertence a um projeto, que define <b>qual CLI</b> roda e <b>em qual diretório</b>.
        </p>

        {erro && <p className="form-error">⚠ {erro}</p>}

        <table className="projects">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ferramenta</th>
              <th>Workspace</th>
              <th>Cards</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {board.projects.length === 0 && (
              <tr>
                <td colSpan={5} className="hint">
                  Nenhum projeto ainda — cadastre um abaixo.
                </td>
              </tr>
            )}
            {board.projects.map((projeto) => {
              const draft = draftDe(projeto);
              return (
                <tr key={projeto.id}>
                  <td>
                    <input
                      value={draft.name}
                      onChange={(evento) => editar(projeto, { name: evento.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={draft.tool}
                      onChange={(evento) => editar(projeto, { tool: evento.target.value })}
                    >
                      {tools.map(([chave, ferramenta]) => (
                        <option key={chave} value={chave}>
                          {ferramenta.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="ws-field">
                      <input
                        value={draft.workspace}
                        onChange={(evento) => editar(projeto, { workspace: evento.target.value })}
                        title="relativo à raiz do app, ou absoluto"
                      />
                      <button
                        type="button"
                        className="ghost"
                        title="escolher pasta"
                        onClick={() => setPicking(picking === projeto.id ? null : projeto.id)}
                      >
                        📁
                      </button>
                    </div>
                    {picking === projeto.id && (
                      <DirPicker
                        start={draft.workspace}
                        onPick={(display) => {
                          editar(projeto, { workspace: display });
                          setPicking(null);
                        }}
                        onClose={() => setPicking(null)}
                      />
                    )}
                  </td>
                  <td className="hint num">{cardsDo(projeto.id)}</td>
                  <td className="row-actions">
                    <button onClick={() => salvar(projeto)} disabled={!sujo(projeto) || ocupado}>
                      Salvar
                    </button>
                    <button
                      className="ghost danger"
                      onClick={() => excluir(projeto)}
                      disabled={ocupado || cardsDo(projeto.id) > 0}
                      title={
                        cardsDo(projeto.id) > 0 ? "esvazie o projeto primeiro" : "excluir projeto"
                      }
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form className="new-project" onSubmit={criar}>
          <h4>Novo projeto</h4>
          <div className="fields">
            <input
              placeholder="Nome (ex.: Minha Empresa)"
              value={novo.name}
              onChange={(evento) => setNovo({ ...novo, name: evento.target.value })}
            />
            <select
              value={novo.tool}
              onChange={(evento) => setNovo({ ...novo, tool: evento.target.value })}
            >
              {tools.map(([chave, ferramenta]) => (
                <option key={chave} value={chave}>
                  {ferramenta.label}
                </option>
              ))}
            </select>
            <div className="ws-field">
              <input
                placeholder="Workspace (ex.: workspaces/minha-empresa)"
                value={novo.workspace}
                onChange={(evento) => setNovo({ ...novo, workspace: evento.target.value })}
              />
              <button
                type="button"
                className="ghost"
                title="escolher pasta"
                onClick={() => setPicking(picking === NOVO ? null : NOVO)}
              >
                📁
              </button>
            </div>
            <button type="submit" disabled={ocupado || !novo.name.trim() || !novo.workspace.trim()}>
              Criar
            </button>
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
          <p className="hint">
            Dá pra digitar o caminho ou clicar em 📁 pra navegar. O diretório é criado se não existir.
          </p>
        </form>
      </div>
    </div>
  );
}
