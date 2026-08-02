"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/atoms/Icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Listing } from "@/lib/fsbrowse";
import { pedirJson } from "@/lib/http";

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
    <div className="bg-background border-primary mt-2 mb-1 rounded-md border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-[13px]">Escolher workspace</b>
        <code className="text-muted-foreground font-mono text-[11px] break-all">
          {listagem?.display ?? "…"}
        </code>
      </div>

      {erro && (
        <p role="alert" className="text-danger mt-2 flex items-center gap-2 text-xs">
          <Icon name="alerta" size="md" />
          {erro}
        </p>
      )}

      <ul className="my-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {listagem?.parent && (
          <li className="flex">
            <Button
              variant="ghost"
              onClick={() => abrir(listagem.parent!)}
              className="h-6.5 flex-1 justify-start px-2 text-xs"
            >
              <Icon name="pasta" size="md" />
              pasta acima
            </Button>
          </li>
        )}
        {listagem?.entries.length === 0 && (
          <li className="text-muted-foreground px-2 text-xs">(sem subpastas)</li>
        )}
        {listagem?.entries.map((pasta) => (
          <li key={pasta.path} className="flex">
            <Button
              variant="ghost"
              onClick={() => abrir(pasta.path)}
              title={pasta.path}
              className="h-6.5 flex-1 justify-start px-2 text-xs"
            >
              <Icon name="pasta" size="md" />
              {pasta.name}
              {pasta.git && (
                <Badge variant="outline" className="text-faint ml-auto text-[9px]">
                  git
                </Badge>
              )}
            </Button>
          </li>
        ))}
      </ul>

      <div className="mb-2 flex gap-1">
        <Input
          aria-label="Nome da nova subpasta"
          placeholder="criar subpasta aqui…"
          value={novaPasta}
          onChange={(evento) => setNovaPasta(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              criarPasta();
            }
          }}
          className="h-6.5 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          onClick={criarPasta}
          disabled={!novaPasta.trim()}
          className="h-6.5 px-2.5 text-[11px]"
        >
          Criar
        </Button>
      </div>

      <div className="flex gap-1">
        <Button
          type="button"
          onClick={() => listagem && onPick(listagem.display)}
          disabled={!listagem}
          className="h-6.5 px-2.5 text-[11px]"
        >
          Usar esta pasta
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-6.5 px-2.5 text-[11px]"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
