"use client";

import { useEffect, useState } from "react";

// Quem corta o texto é o CSS (`line-clamp`), então o React não sabe se o corte
// aconteceu — só o layout sabe. Comparar a altura do conteúdo com a da caixa é
// o que responde isso, e o ResizeObserver refaz a conta quando a coluna muda de
// largura ou a fonte termina de carregar.
export function useTextoCortado(texto: string) {
  const [elementoDoTexto, setElementoDoTexto] = useState<HTMLElement | null>(null);
  const [cortado, setCortado] = useState(false);

  useEffect(() => {
    if (!elementoDoTexto) return;

    // um pixel de folga porque a altura de linha arredondada faz scrollHeight
    // passar clientHeight por fração em texto que cabe inteiro
    const medirCorte = () =>
      setCortado(elementoDoTexto.scrollHeight > elementoDoTexto.clientHeight + 1);

    medirCorte();

    const observador = new ResizeObserver(medirCorte);
    observador.observe(elementoDoTexto);
    return () => observador.disconnect();
  }, [elementoDoTexto, texto]);

  return { medirTexto: setElementoDoTexto, cortado };
}
