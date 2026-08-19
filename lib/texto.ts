// Corpo de requisição chega como `unknown`: um número em vez de string quebraria
// no `.trim()` e viraria 500 com stack.
export function textoNaoVazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

// A prévia do mini-card é uma linha de texto cortada em três pelo CSS. Agora
// que a descrição é markdown, renderizá-la ali traria título, lista e bloco de
// código pra dentro de um `line-clamp` que só sabe cortar texto corrido — e não
// renderizar deixaria os asteriscos à mostra. Então a prévia é a descrição
// reduzida a texto: não é um parser de markdown, é o que dá conta do que o
// editor do board escreve.
const MARCACOES: [RegExp, string][] = [
  [/^ {0,3}```.*$/gm, ""],
  [/^ {0,3}#{1,6} +/gm, ""],
  [/^ {0,3}> ?/gm, ""],
  [/^ *[-*+] +\[[ xX]\] +/gm, ""],
  [/^ *[-*+] +/gm, ""],
  [/^ *\d+\. +/gm, ""],
  // link e imagem viram o rótulo; o endereço não cabe numa prévia de três linhas
  [/!?\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2"],
  // o delimitador simples exige não-palavra em volta pra que nome_com_underscore
  // e multiplicação não sejam lidos como itálico
  [/(?<![\w*])\*(?=\S)([^*\n]*\S)\*(?![\w*])/g, "$1"],
  [/(?<![\w_])_(?=\S)([^_\n]*\S)_(?![\w_])/g, "$1"],
  [/~~(?=\S)([\s\S]*?\S)~~/g, "$1"],
  [/`+/g, ""],
];

export function textoSimplesDeMarkdown(markdown: string): string {
  const semMarcacao = MARCACOES.reduce(
    (texto, [marcacao, substituto]) => texto.replace(marcacao, substituto),
    markdown,
  );
  // parágrafo separado por linha em branco vira uma quebra só: a prévia tem três
  // linhas, e gastar uma com espaço em branco corta o requisito antes da hora
  return semMarcacao.replace(/\n{2,}/g, "\n").trim();
}
