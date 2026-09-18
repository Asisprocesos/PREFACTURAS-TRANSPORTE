/** Variables soportadas en asunto/cuerpo: {PLACA} {RAZON_SOCIAL} {PERIODO} {NUMERO} {TOTAL} */
export interface VariablesPlantilla {
  PLACA: string;
  RAZON_SOCIAL: string;
  PERIODO: string;
  NUMERO: string;
  TOTAL: string;
}

export function interpolarPlantilla(texto: string, variables: VariablesPlantilla): string {
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave: string) => {
    return clave in variables ? variables[clave as keyof VariablesPlantilla] : coincidencia;
  });
}
