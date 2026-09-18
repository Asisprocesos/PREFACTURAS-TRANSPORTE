import { StyleSheet } from "@react-pdf/renderer";

import { defaultAppConfig } from "@/config/app.config";

/**
 * Plantilla separada de la lógica de negocio (src/pdf/generar.ts). Usa los
 * colores de config/app.config.ts para que un cambio de marca no requiera
 * tocar el JSX. Sin fuente Metropolis autoalojada todavía (ver
 * public/brand/README.md): usa Helvetica, la fuente estándar de PDF más
 * cercana en peso disponible sin depender de archivos externos.
 */
export const COLOR = {
  amarillo: defaultAppConfig.empresa.colores.amarillo,
  negro: defaultAppConfig.empresa.colores.negro,
  gris: defaultAppConfig.empresa.colores.gris,
  grisTexto: "#4B4B4B",
  borde: "#D9D9D9",
};

export const estilos = StyleSheet.create({
  pagina: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: COLOR.negro,
  },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 3,
    borderBottomColor: COLOR.amarillo,
    paddingBottom: 8,
    marginBottom: 12,
  },
  marca: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  marcaSub: {
    fontSize: 8,
    color: COLOR.grisTexto,
  },
  tituloDocumento: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    textAlign: "right",
  },
  filaMeta: {
    fontSize: 8,
    textAlign: "right",
    color: COLOR.grisTexto,
  },
  seccion: {
    marginBottom: 14,
  },
  seccionTitulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.amarillo,
    paddingLeft: 6,
  },
  filaCabecera: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  campoCabecera: {
    width: "50%",
    marginBottom: 4,
  },
  etiqueta: {
    fontSize: 7,
    color: COLOR.grisTexto,
    textTransform: "uppercase",
  },
  valor: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  tabla: {
    borderWidth: 1,
    borderColor: COLOR.borde,
  },
  filaTabla: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borde,
  },
  filaTablaCabecera: {
    flexDirection: "row",
    backgroundColor: COLOR.negro,
  },
  celda: {
    padding: 4,
    fontSize: 8,
  },
  celdaCabecera: {
    padding: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  celdaNumerica: {
    padding: 4,
    fontSize: 8,
    textAlign: "right",
  },
  totalFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLOR.negro,
  },
  totalEtiqueta: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginRight: 12,
  },
  totalValor: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  piePagina: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 2,
    borderTopColor: COLOR.amarillo,
    paddingTop: 6,
  },
  piePaginaTexto: {
    fontSize: 7,
    color: COLOR.grisTexto,
    textAlign: "center",
  },
  numeroPagina: {
    position: "absolute",
    bottom: 24,
    right: 36,
    fontSize: 7,
    color: COLOR.grisTexto,
  },
  leyenda: {
    fontSize: 7,
    color: COLOR.grisTexto,
    fontFamily: "Helvetica-Oblique",
    marginTop: 4,
  },
});
