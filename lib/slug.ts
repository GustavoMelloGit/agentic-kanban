const SEM_ACENTO = /[\u0300-\u036f]/g;
const NAO_ALFANUMERICO = /[^a-z0-9]+/g;
const HIFEN_NAS_PONTAS = /^-|-$/g;

export function gerarSlug(texto: string, alternativa: string): string {
  const slug = texto
    .normalize("NFD")
    .replace(SEM_ACENTO, "")
    .toLowerCase()
    .replace(NAO_ALFANUMERICO, "-")
    .replace(HIFEN_NAS_PONTAS, "");
  return slug || alternativa;
}

export function gerarSlugUnico(texto: string, alternativa: string, ocupados: Set<string>): string {
  const base = gerarSlug(texto, alternativa);
  if (!ocupados.has(base)) return base;

  let sufixo = 2;
  while (ocupados.has(`${base}-${sufixo}`)) sufixo++;
  return `${base}-${sufixo}`;
}
