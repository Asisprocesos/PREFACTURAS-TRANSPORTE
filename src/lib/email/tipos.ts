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
}
export type EmailResultado = EmailResultadoOk | EmailResultadoError;

export interface EmailProvider {
  enviar(mensaje: EmailMensaje): Promise<EmailResultado>;
}
