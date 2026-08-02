// Corpo de requisição chega como `unknown`: um número em vez de string quebraria
// no `.trim()` e viraria 500 com stack.
export function textoNaoVazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}
