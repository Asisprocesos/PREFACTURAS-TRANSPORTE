import { Document, Page, Text, View } from "@react-pdf/renderer";

import { estilos } from "./estilos";
import type { DatosPdfPrefactura } from "./tipos";

const formatoMoneda = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function Encabezado({ datos }: { datos: DatosPdfPrefactura }) {
  return (
    <View style={estilos.encabezado} fixed>
      <View>
        <Text style={estilos.marca}>{datos.empresa.nombre}</Text>
        <Text style={estilos.marcaSub}>{datos.empresa.nombreDocumento}</Text>
      </View>
      <View>
        <Text style={estilos.tituloDocumento}>{datos.empresa.nombreDocumento.toUpperCase()}</Text>
        <Text style={estilos.filaMeta}>N.º {datos.numero}</Text>
        <Text style={estilos.filaMeta}>Período {datos.periodoNombre}</Text>
        <Text style={estilos.filaMeta}>Emitida el {datos.fechaEmision}</Text>
      </View>
    </View>
  );
}

function PiePagina({ datos }: { datos: DatosPdfPrefactura }) {
  return (
    <View style={estilos.piePagina} fixed>
      <Text style={estilos.piePaginaTexto}>
        Quito: {datos.empresa.contacto.quito} · Guayaquil: {datos.empresa.contacto.guayaquil} · Tel.{" "}
        {datos.empresa.contacto.telefono} · {datos.empresa.contacto.sitioWeb}
      </Text>
      <Text style={estilos.leyenda}>{datos.leyenda}</Text>
    </View>
  );
}

function NumeroPagina() {
  return (
    <Text
      style={estilos.numeroPagina}
      render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      fixed
    />
  );
}

export function DocumentoPrefactura({ datos }: { datos: DatosPdfPrefactura }) {
  return (
    <Document title={`${datos.empresa.nombreDocumento} ${datos.numero}`}>
      <Page size="A4" style={estilos.pagina} wrap>
        <Encabezado datos={datos} />

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Datos del vehículo</Text>
          <View style={estilos.filaCabecera}>
            <View style={estilos.campoCabecera}>
              <Text style={estilos.etiqueta}>Placa</Text>
              <Text style={estilos.valor}>{datos.placa}</Text>
            </View>
            <View style={estilos.campoCabecera}>
              <Text style={estilos.etiqueta}>Conductor</Text>
              <Text style={estilos.valor}>{datos.conductor ?? "—"}</Text>
            </View>
            <View style={estilos.campoCabecera}>
              <Text style={estilos.etiqueta}>Razón social</Text>
              <Text style={estilos.valor}>{datos.razonSocial}</Text>
            </View>
            <View style={estilos.campoCabecera}>
              <Text style={estilos.etiqueta}>RUC</Text>
              <Text style={estilos.valor}>{datos.ruc}</Text>
            </View>
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Resumen de facturación</Text>
          <View style={estilos.tabla}>
            <View style={estilos.filaTablaCabecera} fixed>
              <Text style={[estilos.celdaCabecera, { width: "28%" }]}>Centro de costo final</Text>
              <Text style={[estilos.celdaCabecera, { width: "22%" }]}>Regional</Text>
              <Text style={[estilos.celdaCabecera, { width: "20%" }]}>Ruta</Text>
              <Text style={[estilos.celdaCabecera, { width: "10%", textAlign: "right" }]}>Cantidad</Text>
              <Text style={[estilos.celdaCabecera, { width: "20%", textAlign: "right" }]}>Subtotal</Text>
            </View>
            {datos.resumenCentroCosto.map((r, i) => (
              <View style={estilos.filaTabla} key={i}>
                <Text style={[estilos.celda, { width: "28%" }]}>{r.centroCosto}</Text>
                <Text style={[estilos.celda, { width: "22%" }]}>{r.regional}</Text>
                <Text style={[estilos.celda, { width: "20%" }]}>{r.ruta}</Text>
                <Text style={[estilos.celdaNumerica, { width: "10%" }]}>{r.cantidad}</Text>
                <Text style={[estilos.celdaNumerica, { width: "20%" }]}>{formatoMoneda.format(r.suma)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.seccion}>
          <Text style={estilos.seccionTitulo}>Detalle de ODT</Text>
          <View style={estilos.tabla}>
            <View style={estilos.filaTablaCabecera} fixed>
              <Text style={[estilos.celdaCabecera, { width: "6%" }]}>#</Text>
              <Text style={[estilos.celdaCabecera, { width: "12%" }]}>Fecha</Text>
              <Text style={[estilos.celdaCabecera, { width: "22%" }]}>Ruta</Text>
              <Text style={[estilos.celdaCabecera, { width: "16%" }]}>Regional</Text>
              <Text style={[estilos.celdaCabecera, { width: "20%" }]}>Centro de costo</Text>
              <Text style={[estilos.celdaCabecera, { width: "14%" }]}>Guía</Text>
              <Text style={[estilos.celdaCabecera, { width: "10%", textAlign: "right" }]}>Valor</Text>
            </View>
            {datos.detalleOdt.map((o) => (
              <View style={estilos.filaTabla} key={o.item} wrap={false}>
                <Text style={[estilos.celda, { width: "6%" }]}>{o.item}</Text>
                <Text style={[estilos.celda, { width: "12%" }]}>{o.fecha}</Text>
                <Text style={[estilos.celda, { width: "22%" }]}>{o.ruta}</Text>
                <Text style={[estilos.celda, { width: "16%" }]}>{o.regional}</Text>
                <Text style={[estilos.celda, { width: "20%" }]}>{o.centroCosto}</Text>
                <Text style={[estilos.celda, { width: "14%" }]}>{o.guia}</Text>
                <Text style={[estilos.celdaNumerica, { width: "10%" }]}>{formatoMoneda.format(o.valor)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.totalFila}>
          <Text style={estilos.totalEtiqueta}>TOTAL</Text>
          <Text style={estilos.totalValor}>{formatoMoneda.format(datos.total)}</Text>
        </View>

        <PiePagina datos={datos} />
        <NumeroPagina />
      </Page>
    </Document>
  );
}
