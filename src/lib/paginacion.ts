/**
 * Arma la lista de botones a mostrar en un paginador numerado: siempre la
 * primera y la última página, más una ventana alrededor de la página
 * actual, con "..." donde se salta un tramo — para no mostrar 200 botones
 * cuando hay 200 páginas. Pura y testeable aparte del componente.
 */
export function construirPaginasVisibles(
  pagina: number,
  totalPaginas: number,
  vecinos = 1,
): (number | "...")[] {
  if (totalPaginas <= 0) return [];
  // Con pocas páginas, la ventana + bordes + "..." no ahorra espacio frente
  // a listarlas todas — y agregar un "..." que solo esconde una página se ve
  // peor, no mejor.
  if (totalPaginas <= 2 * vecinos + 5) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }

  const paginas = new Set<number>([1, totalPaginas]);
  for (let p = pagina - vecinos; p <= pagina + vecinos; p++) {
    if (p >= 1 && p <= totalPaginas) paginas.add(p);
  }

  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado: (number | "...")[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) resultado.push("...");
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}
