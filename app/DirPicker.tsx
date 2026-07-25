"use client";

import { useCallback, useEffect, useState } from "react";
import type { Listing } from "../lib/fsbrowse";
import { pedirJson } from "../lib/http";

function urlDaListagem(caminho?: string): string {
  return `/api/fs${caminho ? `?path=${encodeURIComponent(caminho)}` : ""}`;
}

export default function DirPicker({
  start,
  onPick,
  onClose,
}: {
  start?: string;
  onPick: (display: string) => void;
  onClose: () => void;
}) {
  const [listagem, setListagem] = useState<Listing | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaPasta, setNovaPasta] = useState("");

  const abrir = useCallback(async (caminho?: string) => {
    setErro(null);
    const resultado = await pedirJson<Listing>(urlDaListagem(caminho));
    if (!resultado.ok) {
      setErro(resultado.erro ?? "não foi possível listar a pasta");
      return;
    }
    setListagem(resultado.dados!);
  }, []);

  // Abre na pasta do campo; se ela não existir, cai na raiz do app.
  useEffect(() => {
    (async () => {
      const doCampo = await pedirJson<Listing>(urlDaListagem(start));
      if (doCampo.ok) setListagem(doCampo.dados!);
      else abrir();
    })();
  }, [start, abrir]);

  async function criarPasta() {
    if (!listagem || !novaPasta.trim()) return;
    setErro(null);

    const resultado = await pedirJson<Listing>("/api/fs", {
      method: "POST",
      body: JSON.stringify({ parent: listagem.path, name: novaPasta }),
    });
    if (!resultado.ok) {
      setErro(resultado.erro ?? "não foi possível criar a pasta");
      return;
    }

    setNovaPasta("");
    setListagem(resultado.dados!);
  }

  return (
    <div className="dirpicker">
      <div className="dp-head">
        <b>Escolher workspace</b>
        <code title={listagem?.path}>{listagem?.display ?? "…"}</code>
      </div>

      {erro && <p className="form-error">⚠ {erro}</p>}

      <ul className="dp-list">
        {listagem?.parent && (
          <li>
            <button className="ghost" onClick={() => abrir(listagem.parent!)}>
              ⬆ ..
            </button>
          </li>
        )}
        {listagem?.entries.length === 0 && <li className="hint">(sem subpastas)</li>}
        {listagem?.entries.map((pasta) => (
          <li key={pasta.path}>
            <button className="ghost" onClick={() => abrir(pasta.path)} title={pasta.path}>
              📁 {pasta.name}
              {pasta.git && <span className="badge">git</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="dp-new">
        <input
          placeholder="criar subpasta aqui…"
          value={novaPasta}
          onChange={(evento) => setNovaPasta(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              criarPasta();
            }
          }}
        />
        <button type="button" className="ghost" onClick={criarPasta} disabled={!novaPasta.trim()}>
          Criar
        </button>
      </div>

      <div className="dp-actions">
        <button
          type="button"
          onClick={() => listagem && onPick(listagem.display)}
          disabled={!listagem}
        >
          Usar esta pasta
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
