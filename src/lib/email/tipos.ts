export interface AdjuntoEmail {
  nombreArchivo: string;
  contenido: Buffer;
  contentType: string;
}

export interface EmailMensaje {
  to: string[];
  cc?: string[];
  asunto: string;
  cuerpo: string;
  adjuntos?: AdjuntoEmail[];
}

export interface EmailResultadoOk {
  ok: true;
  messageId: string;
}
export interface EmailResultadoError {
  ok: false;
  error: string;
  /** Errores permanentes (buzón inexistente, 5xx del proveedor) no se reintentan igual que los temporales. */
  permanente: boolean;
  /** Gmail alcanzó su límite diario de envíos: no es culpa de este correo ni de la cuenta en general, se resuelve solo mañana (o cambiando de cuenta en Configuración) — ver smtp.ts y el circuit breaker en /api/jobs/email. */
  cupoAgotado?: boolean;
}
export type EmailResultado = EmailResultadoOk | EmailResultadoError;

export interface EmailProvider {
  enviar(mensaje: EmailMensaje): Promise<EmailResultado>;
}
