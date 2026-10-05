# bpmn-generator (skill de proyecto)

Genera archivos BPMN 2.0 XML a partir de descripciones de proceso en lenguaje
natural o de documentos markdown estructurados.

## Uso

La skill se activa sola cuando pides crear/modelar un proceso BPMN, o
explícitamente con `/bpmn-generator`.

- **Modo interactivo:** describe el proceso y la skill hace preguntas por fases
  (alcance, participantes, actividades, control de flujo, eventos, datos).
- **Modo documento:** pásale la ruta de un `.md` y extrae la estructura del
  documento (H1 = proceso, "Fase/Paso" = fases, listas numeradas = tareas,
  tablas de roles = carriles).

Acepta el flag `--preview` para validar y resumir el XML antes de escribirlo.

## Origen

Tomada de `plugins/bpmn-plugin/skills/bpmn-generator` del repositorio
[davistroy/claude-marketplace](https://github.com/davistroy/claude-marketplace)
(bpmn-plugin v4.4.0, licencia MIT — ver `LICENSE`).

## Cambios respecto al original

El original es parte de un plugin y resuelve sus archivos de apoyo desde la raíz
del plugin (`../references/`, `../templates/`). Aquí es una skill autocontenida,
así que:

1. Se copiaron dentro de la skill los archivos que `SKILL.md` referencia:
   `references/` (5 archivos), `templates/` (3 archivos).
2. Se reescribieron las rutas `../references/` → `references/`,
   `../templates/` → `templates/`, `../examples/` → `examples/`.
3. De `examples/` se incluyeron solo 3 ejemplos pequeños (`simple-approval`,
   `parallel-processing`, `subprocess-example`) en lugar de los 7 del original.

No se instaló la skill hermana `bpmn-to-drawio`, que `SKILL.md` menciona para
convertir BPMN a Draw.io.
