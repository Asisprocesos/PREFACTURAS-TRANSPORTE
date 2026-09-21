/**
 * Tipos de la base de datos, escritos a mano a partir de
 * `supabase/migrations/`. Lo ideal es regenerarlos con
 * `npm run supabase:types` contra un proyecto Supabase real (local o
 * remoto) en cuanto exista uno — ese comando SOBRESCRIBE este archivo
 * completo con el resultado real de introspección, que es la fuente de
 * verdad. Mientras tanto, cualquier cambio a una migración debe reflejarse
 * aquí a mano para mantener el typecheck honesto.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RolUsuario = "ADMIN" | "OPERADOR_TRANSPORTE" | "CONSULTA";
export type EstadoPeriodo = "ABIERTO" | "CERRADO" | "ARCHIVADO";
export type EstadoImportacion = "BORRADOR" | "VALIDADA" | "CONFIRMADA" | "REVERTIDA";
export type DecisionFila = "INSERTAR" | "OMITIR" | "CORREGIR";
export type EstadoPrefactura =
  | "BORRADOR"
  | "CON_NOVEDADES"
  | "LISTA"
  | "PDF_GENERADO"
  | "EN_COLA_ENVIO"
  | "ENVIADA"
  | "ERROR_ENVIO"
  | "REQUIERE_REGENERAR"
  | "ANULADA";
export type EstadoDocumentoPdf = "VIGENTE" | "REEMPLAZADO";
export type EstadoEnvio = "PENDIENTE" | "ENVIANDO" | "ENVIADO" | "ERROR" | "REINTENTAR";
export type TipoLoteProceso = "PDF" | "CORREO" | "VALIDACION";
export type EstadoLoteProceso = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "COMPLETADO_CON_ERRORES";
export type SeveridadNovedad = "ERROR" | "ADVERTENCIA" | "INFO";
export type EstadoNovedad = "ABIERTA" | "RESUELTA" | "IGNORADA";
export type EtapaLogEjecucion = "IMPORTACION" | "VALIDACION" | "PDF" | "CORREO";
export type EstadoLogEjecucion = "OK" | "ADVERTENCIA" | "ERROR";
export type TipoContactoCorreo = "PRINCIPAL" | "ADICIONAL";
export type MacroNegocio = "CORE" | "TEMU";
export type ResultadoMatchEscaneo =
  "ESCANEADA_Y_CARGADA" | "ESCANEADA_NO_CARGADA" | "CARGADA_SIN_FISICA" | "OTRA_PLACA_O_PERIODO";

// `type`, no `interface`: TypeScript solo infiere una firma de índice
// implícita compatible con `Record<string, unknown>` para alias de tipo
// object-literal, no para `interface` — con `interface` aquí, todas las
// tablas que la intersectan dejan de cumplir `GenericSchema` de
// @supabase/supabase-js y el cliente tipado colapsa a `never`.
type Auditable = {
  created_at: string;
  updated_at: string;
};

type ConDuenio = {
  created_by: string | null;
};

export interface Database {
  public: {
    Tables: {
      regional: {
        Row: {
          id: string;
          nombre: string;
          codigo: string | null;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          nombre: string;
          codigo?: string | null;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["regional"]["Insert"]>;
        Relationships: [];
      };
      periodo: {
        Row: {
          id: string;
          numero: number;
          nombre: string;
          fecha_inicio: string;
          fecha_fin: string;
          estado: EstadoPeriodo;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          numero: number;
          nombre: string;
          fecha_inicio: string;
          fecha_fin: string;
          estado?: EstadoPeriodo;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["periodo"]["Insert"]>;
        Relationships: [];
      };
      ruta_macro: {
        Row: {
          id: string;
          ruta_principal: string;
          ruta_macro: string;
          tarifa: number | null;
          km: number | null;
          horas_viaje: number | null;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          ruta_principal: string;
          ruta_macro: string;
          tarifa?: number | null;
          km?: number | null;
          horas_viaje?: number | null;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ruta_macro"]["Insert"]>;
        Relationships: [];
      };
      tipo_ruta_centro_costo: {
        Row: {
          id: string;
          tipo_ruta: string;
          macro: MacroNegocio | null;
          centro_costo: string | null;
          requiere_revision: boolean;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          tipo_ruta: string;
          macro?: MacroNegocio | null;
          centro_costo?: string | null;
          requiere_revision?: boolean;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tipo_ruta_centro_costo"]["Insert"]>;
        Relationships: [];
      };
      calendario: {
        Row: { fecha: string; dia_texto: string; laborable: boolean };
        Insert: { fecha: string; dia_texto: string; laborable: boolean };
        Update: Partial<Database["public"]["Tables"]["calendario"]["Insert"]>;
        Relationships: [];
      };
      transportista: {
        Row: {
          id: string;
          ruc: string;
          razon_social: string;
          nombre: string | null;
          tipo_transportista: string | null;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          ruc: string;
          razon_social: string;
          nombre?: string | null;
          tipo_transportista?: string | null;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["transportista"]["Insert"]>;
        Relationships: [];
      };
      vehiculo: {
        Row: {
          id: string;
          placa: string;
          transportista_id: string | null;
          propietario: string | null;
          marca: string | null;
          modelo: string | null;
          anio: number | null;
          tonelaje: number | null;
          tipo_vehiculo: string | null;
          largo: number | null;
          alto: number | null;
          ancho: number | null;
          cubicaje: number | null;
          regional_id: string | null;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          placa: string;
          transportista_id?: string | null;
          propietario?: string | null;
          marca?: string | null;
          modelo?: string | null;
          anio?: number | null;
          tonelaje?: number | null;
          tipo_vehiculo?: string | null;
          largo?: number | null;
          alto?: number | null;
          ancho?: number | null;
          cubicaje?: number | null;
          regional_id?: string | null;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehiculo"]["Insert"]>;
        Relationships: [];
      };
      conductor: {
        Row: {
          id: string;
          nombres: string | null;
          apellidos: string | null;
          identificacion: string | null;
          activo: boolean;
          deleted_at: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          nombres?: string | null;
          apellidos?: string | null;
          identificacion?: string | null;
          activo?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["conductor"]["Insert"]>;
        Relationships: [];
      };
      vehiculo_conductor: {
        Row: {
          id: string;
          vehiculo_id: string;
          conductor_id: string;
          vigente_desde: string;
          vigente_hasta: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          vehiculo_id: string;
          conductor_id: string;
          vigente_desde?: string;
          vigente_hasta?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehiculo_conductor"]["Insert"]>;
        Relationships: [];
      };
      contacto_correo: {
        Row: {
          id: string;
          vehiculo_id: string | null;
          transportista_id: string | null;
          email: string;
          tipo: TipoContactoCorreo;
          activo: boolean;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          vehiculo_id?: string | null;
          transportista_id?: string | null;
          email: string;
          tipo?: TipoContactoCorreo;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["contacto_correo"]["Insert"]>;
        Relationships: [];
      };
      mapeo_columna: {
        Row: {
          id: string;
          plantilla: string;
          alias_origen: string;
          campo_interno: string;
          transformacion: string | null;
          activo: boolean;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          plantilla?: string;
          alias_origen: string;
          campo_interno: string;
          transformacion?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mapeo_columna"]["Insert"]>;
        Relationships: [];
      };
      importacion: {
        Row: {
          id: string;
          archivo: string;
          storage_key: string;
          hash_sha256: string;
          hoja: string | null;
          periodo_id: string | null;
          filas_leidas: number;
          filas_validas: number;
          filas_con_error: number;
          filas_advertencias: number;
          estado: EstadoImportacion;
          usuario: string | null;
        } & Auditable;
        Insert: {
          id?: string;
          archivo: string;
          storage_key: string;
          hash_sha256: string;
          hoja?: string | null;
          periodo_id?: string | null;
          filas_leidas?: number;
          filas_validas?: number;
          filas_con_error?: number;
          filas_advertencias?: number;
          estado?: EstadoImportacion;
          usuario?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["importacion"]["Insert"]>;
        Relationships: [];
      };
      importacion_fila: {
        Row: {
          id: string;
          importacion_id: string;
          numero_fila: number;
          datos_crudos: Json;
          datos_normalizados: Json | null;
          errores: Json;
          advertencias: Json;
          decision: DecisionFila | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          importacion_id: string;
          numero_fila: number;
          datos_crudos: Json;
          datos_normalizados?: Json | null;
          errores?: Json;
          advertencias?: Json;
          decision?: DecisionFila | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["importacion_fila"]["Insert"]>;
        Relationships: [];
      };
      odt: {
        Row: {
          id: string;
          guia: string;
          importacion_id: string | null;
          periodo_id: string | null;
          vehiculo_id: string | null;
          placa_original: string | null;
          placa_normalizada: string | null;
          chofer: string | null;
          ruta: string | null;
          ruta_zona: string | null;
          detalle_ruta: string | null;
          regional_origen_texto: string | null;
          regional_destino_texto: string | null;
          regional_origen_id: string | null;
          regional_destino_id: string | null;
          estado_fenix: string | null;
          fecha_recepcion: string | null;
          fecha_creacion: string;
          usuario_fenix: string | null;
          valor: number;
          tipo_costo: string | null;
          tipo_ruta: string | null;
          valor_final: number | null;
          ruta_macro: string | null;
          centro_costo_final: string | null;
          core_temu: MacroNegocio | null;
          dia_texto: string | null;
          semana: number | null;
          mes: number | null;
          anio: number | null;
          laborable: boolean | null;
          corregida: boolean;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          guia: string;
          importacion_id?: string | null;
          periodo_id?: string | null;
          vehiculo_id?: string | null;
          placa_original?: string | null;
          placa_normalizada?: string | null;
          chofer?: string | null;
          ruta?: string | null;
          ruta_zona?: string | null;
          detalle_ruta?: string | null;
          regional_origen_texto?: string | null;
          regional_destino_texto?: string | null;
          regional_origen_id?: string | null;
          regional_destino_id?: string | null;
          estado_fenix?: string | null;
          fecha_recepcion?: string | null;
          fecha_creacion: string;
          usuario_fenix?: string | null;
          valor?: number;
          tipo_costo?: string | null;
          tipo_ruta?: string | null;
          valor_final?: number | null;
          ruta_macro?: string | null;
          centro_costo_final?: string | null;
          core_temu?: MacroNegocio | null;
          dia_texto?: string | null;
          semana?: number | null;
          mes?: number | null;
          anio?: number | null;
          laborable?: boolean | null;
          corregida?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["odt"]["Insert"]>;
        Relationships: [];
      };
      odt_correccion: {
        Row: {
          id: string;
          odt_id: string;
          campo: string;
          valor_anterior: string | null;
          valor_nuevo: string | null;
          motivo: string;
          usuario: string | null;
          fecha: string;
        };
        Insert: {
          id?: string;
          odt_id: string;
          campo: string;
          valor_anterior?: string | null;
          valor_nuevo?: string | null;
          motivo: string;
          usuario?: string | null;
          fecha?: string;
        };
        Update: Partial<Database["public"]["Tables"]["odt_correccion"]["Insert"]>;
        Relationships: [];
      };
      correlativo: {
        Row: { anio: number; secuencia: number };
        Insert: { anio: number; secuencia?: number };
        Update: Partial<Database["public"]["Tables"]["correlativo"]["Insert"]>;
        Relationships: [];
      };
      prefactura: {
        Row: {
          id: string;
          numero: string | null;
          periodo_id: string;
          vehiculo_id: string;
          transportista_id: string;
          total_odt: number;
          total_descuentos: number;
          total: number;
          cantidad_odt: number;
          estado: EstadoPrefactura;
          version_actual: number;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          numero?: string | null;
          periodo_id: string;
          vehiculo_id: string;
          transportista_id: string;
          total_odt?: number;
          total_descuentos?: number;
          total?: number;
          cantidad_odt?: number;
          estado?: EstadoPrefactura;
          version_actual?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["prefactura"]["Insert"]>;
        Relationships: [];
      };
      prefactura_detalle: {
        Row: { id: string; prefactura_id: string; odt_id: string; created_at: string };
        Insert: { id?: string; prefactura_id: string; odt_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["prefactura_detalle"]["Insert"]>;
        Relationships: [];
      };
      descuento: {
        Row: {
          id: string;
          prefactura_id: string;
          item: string | null;
          fecha: string | null;
          concepto: string | null;
          valor: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          prefactura_id: string;
          item?: string | null;
          fecha?: string | null;
          concepto?: string | null;
          valor: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["descuento"]["Insert"]>;
        Relationships: [];
      };
      factura_transportista: {
        Row: {
          id: string;
          prefactura_id: string;
          numero_factura: string | null;
          numero_comprobante: string | null;
          fecha_entrega: string | null;
          valor_factura: number | null;
          observaciones: string | null;
        } & Auditable &
          ConDuenio;
        Insert: {
          id?: string;
          prefactura_id: string;
          numero_factura?: string | null;
          numero_comprobante?: string | null;
          fecha_entrega?: string | null;
          valor_factura?: number | null;
          observaciones?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["factura_transportista"]["Insert"]>;
        Relationships: [];
      };
      documento_pdf: {
        Row: {
          id: string;
          prefactura_id: string;
          nombre_archivo: string;
          storage_provider: string;
          storage_key: string;
          version: number;
          tamano_bytes: number | null;
          checksum: string | null;
          generado_por: string | null;
          generado_en: string;
          estado: EstadoDocumentoPdf;
        };
        Insert: {
          id?: string;
          prefactura_id: string;
          nombre_archivo: string;
          storage_provider?: string;
          storage_key: string;
          version: number;
          tamano_bytes?: number | null;
          checksum?: string | null;
          generado_por?: string | null;
          generado_en?: string;
          estado?: EstadoDocumentoPdf;
        };
        Update: Partial<Database["public"]["Tables"]["documento_pdf"]["Insert"]>;
        Relationships: [];
      };
      lote_proceso: {
        Row: {
          id: string;
          tipo: TipoLoteProceso;
          total: number;
          exitosos: number;
          fallidos: number;
          estado: EstadoLoteProceso;
          iniciado_por: string | null;
        } & Auditable;
        Insert: {
          id?: string;
          tipo: TipoLoteProceso;
          total?: number;
          exitosos?: number;
          fallidos?: number;
          estado?: EstadoLoteProceso;
          iniciado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lote_proceso"]["Insert"]>;
        Relationships: [];
      };
      envio_correo: {
        Row: {
          id: string;
          prefactura_id: string;
          documento_pdf_id: string | null;
          lote_id: string | null;
          destinatarios_to: Json;
          destinatarios_cc: Json;
          asunto: string;
          cuerpo: string | null;
          estado: EstadoEnvio;
          intentos: number;
          proximo_intento: string | null;
          message_id: string | null;
          error: string | null;
          enviado_por: string | null;
          enviado_en: string | null;
        } & Auditable;
        Insert: {
          id?: string;
          prefactura_id: string;
          documento_pdf_id?: string | null;
          lote_id?: string | null;
          destinatarios_to?: Json;
          destinatarios_cc?: Json;
          asunto: string;
          cuerpo?: string | null;
          estado?: EstadoEnvio;
          intentos?: number;
          proximo_intento?: string | null;
          message_id?: string | null;
          error?: string | null;
          enviado_por?: string | null;
          enviado_en?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["envio_correo"]["Insert"]>;
        Relationships: [];
      };
      novedad: {
        Row: {
          id: string;
          tipo: string;
          severidad: SeveridadNovedad;
          entidad: string;
          entidad_id: string | null;
          placa: string | null;
          guia: string | null;
          periodo_id: string | null;
          mensaje: string;
          accion_sugerida: string | null;
          estado: EstadoNovedad;
          resuelta_por: string | null;
          resolucion: string | null;
        } & Auditable;
        Insert: {
          id?: string;
          tipo: string;
          severidad: SeveridadNovedad;
          entidad: string;
          entidad_id?: string | null;
          placa?: string | null;
          guia?: string | null;
          periodo_id?: string | null;
          mensaje: string;
          accion_sugerida?: string | null;
          estado?: EstadoNovedad;
          resuelta_por?: string | null;
          resolucion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["novedad"]["Insert"]>;
        Relationships: [];
      };
      sesion_escaneo: {
        Row: {
          id: string;
          periodo_id: string;
          placa: string | null;
          iniciada_por: string | null;
          iniciada_en: string;
          finalizada_en: string | null;
        };
        Insert: {
          id?: string;
          periodo_id: string;
          placa?: string | null;
          iniciada_por?: string | null;
          iniciada_en?: string;
          finalizada_en?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sesion_escaneo"]["Insert"]>;
        Relationships: [];
      };
      escaneo_odt: {
        Row: {
          id: string;
          sesion_id: string;
          guia_escaneada: string;
          escaneado_por: string | null;
          escaneado_en: string;
        };
        Insert: {
          id?: string;
          sesion_id: string;
          guia_escaneada: string;
          escaneado_por?: string | null;
          escaneado_en?: string;
        };
        Update: Partial<Database["public"]["Tables"]["escaneo_odt"]["Insert"]>;
        Relationships: [];
      };
      log_ejecucion: {
        Row: {
          id: string;
          ejecucion_id: string;
          guia: string | null;
          etapa: EtapaLogEjecucion;
          estado: EstadoLogEjecucion;
          detalle: Json | null;
          fecha: string;
        };
        Insert: {
          id?: string;
          ejecucion_id: string;
          guia?: string | null;
          etapa: EtapaLogEjecucion;
          estado: EstadoLogEjecucion;
          detalle?: Json | null;
          fecha?: string;
        };
        Update: Partial<Database["public"]["Tables"]["log_ejecucion"]["Insert"]>;
        Relationships: [];
      };
      auditoria: {
        Row: {
          id: string;
          usuario: string | null;
          accion: string;
          tabla: string;
          registro_id: string | null;
          antes: Json | null;
          despues: Json | null;
          ip: string | null;
          fecha: string;
        };
        Insert: {
          id?: string;
          usuario?: string | null;
          accion: string;
          tabla: string;
          registro_id?: string | null;
          antes?: Json | null;
          despues?: Json | null;
          ip?: string | null;
          fecha?: string;
        };
        Update: Partial<Database["public"]["Tables"]["auditoria"]["Insert"]>;
        Relationships: [];
      };
      configuracion: {
        Row: { clave: string; valor: Json; updated_at: string; updated_by: string | null };
        Insert: { clave: string; valor: Json; updated_at?: string; updated_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["configuracion"]["Insert"]>;
        Relationships: [];
      };
      perfil_usuario: {
        Row: {
          user_id: string;
          nombre: string | null;
          rol: RolUsuario;
          activo: boolean;
        } & Auditable;
        Insert: {
          user_id: string;
          nombre?: string | null;
          rol?: RolUsuario;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["perfil_usuario"]["Insert"]>;
        Relationships: [];
      };
      odt_indice_historico: {
        Row: {
          id: string;
          guia: string;
          placa: string | null;
          periodo_id: string | null;
          valor: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          guia: string;
          placa?: string | null;
          periodo_id?: string | null;
          valor?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["odt_indice_historico"]["Insert"]>;
        Relationships: [];
      };
      archivo_periodo: {
        Row: {
          id: string;
          periodo_id: string;
          storage_key: string;
          filas: number | null;
          checksum: string | null;
          archivado_en: string;
          archivado_por: string | null;
        };
        Insert: {
          id?: string;
          periodo_id: string;
          storage_key: string;
          filas?: number | null;
          checksum?: string | null;
          archivado_en?: string;
          archivado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["archivo_periodo"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      v_resumen_facturacion: {
        Row: {
          prefactura_id: string | null;
          centro_costo_final: string | null;
          regional: string | null;
          ruta_macro: string | null;
          cantidad: number | null;
          suma: number | null;
          valor_unitario_promedio: number | null;
        };
        Relationships: [];
      };
      v_total_facturacion: {
        Row: { prefactura_id: string | null; total_general: number | null };
        Relationships: [];
      };
    };
    Functions: {
      rol_actual: { Args: Record<string, never>; Returns: RolUsuario };
      siguiente_correlativo: { Args: { p_anio: number }; Returns: number };
      match_escaneo: {
        Args: { p_sesion_id: string };
        Returns: { guia: string; resultado: ResultadoMatchEscaneo; odt_id: string | null }[];
      };
      confirmar_importacion: {
        Args: { p_importacion_id: string };
        Returns: { odt_insertadas: number; novedades_generadas: number }[];
      };
      revertir_importacion: { Args: { p_importacion_id: string }; Returns: undefined };
      generar_prefacturas_periodo: {
        Args: { p_periodo_id: string };
        Returns: { prefacturas_creadas: number; prefacturas_actualizadas: number }[];
      };
      tomar_lote_envio_correo: {
        Args: { p_limite: number };
        Returns: Database["public"]["Tables"]["envio_correo"]["Row"][];
      };
      incrementar_progreso_lote: { Args: { p_lote_id: string; p_exitoso: boolean }; Returns: undefined };
      dashboard_indicadores: {
        Args: { p_periodo_id: string | null };
        Returns: {
          total_prefacturas: number;
          prefacturas_borrador: number;
          prefacturas_con_novedades: number;
          prefacturas_listas: number;
          prefacturas_pdf_generado: number;
          prefacturas_en_cola_envio: number;
          prefacturas_enviadas: number;
          prefacturas_error_envio: number;
          monto_total_prefacturado: number;
          total_odt: number;
          total_transportistas_activos: number;
          total_vehiculos_activos: number;
          novedades_abiertas_error: number;
          novedades_abiertas_advertencia: number;
          novedades_abiertas_info: number;
        }[];
      };
      dashboard_prefacturas_por_estado: {
        Args: { p_periodo_id: string | null };
        Returns: { estado: EstadoPrefactura; cantidad: number }[];
      };
      dashboard_monto_por_centro_costo: {
        Args: { p_periodo_id: string | null; p_limite?: number };
        Returns: { centro_costo: string; monto: number; cantidad: number }[];
      };
      dashboard_monto_por_regional: {
        Args: { p_periodo_id: string | null };
        Returns: { regional: string; monto: number; cantidad: number }[];
      };
      dashboard_top_placas: {
        Args: { p_periodo_id: string | null; p_limite?: number };
        Returns: { placa: string; transportista: string | null; monto: number; cantidad: number }[];
      };
    };
    Enums: {
      rol_usuario: RolUsuario;
      estado_periodo: EstadoPeriodo;
      estado_importacion: EstadoImportacion;
      decision_fila: DecisionFila;
      estado_prefactura: EstadoPrefactura;
      estado_documento_pdf: EstadoDocumentoPdf;
      estado_envio: EstadoEnvio;
      tipo_lote_proceso: TipoLoteProceso;
      estado_lote_proceso: EstadoLoteProceso;
      severidad_novedad: SeveridadNovedad;
      estado_novedad: EstadoNovedad;
      etapa_log_ejecucion: EtapaLogEjecucion;
      estado_log_ejecucion: EstadoLogEjecucion;
      tipo_contacto_correo: TipoContactoCorreo;
      macro_negocio: MacroNegocio;
    };
    CompositeTypes: Record<string, never>;
  };
}
