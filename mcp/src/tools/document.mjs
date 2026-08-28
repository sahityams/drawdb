import { z } from "zod";
import { emptyDoc, nanoid, validateDoc } from "../doc/model.mjs";

const DocumentInputSchema = z.record(z.any());
const PatchSchema = z.record(z.any());
const FieldInputSchema = z.record(z.any());
const ReferenceInputSchema = z.object({
  startTableId: z.string(),
  startFieldId: z.string(),
  endTableId: z.string(),
  endFieldId: z.string(),
  name: z.string().optional(),
  cardinality: z.string().optional(),
  updateConstraint: z.string().optional(),
  deleteConstraint: z.string().optional(),
  fields: z
    .array(
      z.object({
        startFieldId: z.string(),
        endFieldId: z.string(),
      }),
    )
    .optional(),
});

function cloneDoc(document) {
  return structuredClone(document);
}

function withWarnings(document) {
  return {
    document,
    warnings: validateDoc(document).warnings,
  };
}

function withId(document, id) {
  return {
    ...withWarnings(document),
    id,
  };
}

function findTable(document, tableId) {
  const table = document.tables.find((candidate) => candidate.id === tableId);
  if (!table) {
    throw new Error(`Table "${tableId}" not found.`);
  }
  return table;
}

function findField(table, fieldId) {
  const field = table.fields.find((candidate) => candidate.id === fieldId);
  if (!field) {
    throw new Error(`Field "${fieldId}" not found.`);
  }
  return field;
}

function normalizeTable({ id, name, x = 0, y = 0, fields = [], ...rest }) {
  return {
    id,
    name,
    x,
    y,
    comment: "",
    fields,
    indices: [],
    uniqueConstraints: [],
    ...rest,
  };
}

function normalizeField({ id, name, type, ...rest }) {
  return {
    id,
    name,
    type,
    primary: false,
    unique: false,
    notNull: false,
    increment: false,
    default: "",
    check: "",
    comment: "",
    size: "",
    ...rest,
  };
}

export function createDocument({ database = "generic" } = {}) {
  return emptyDoc(database);
}

export function getDocument({ document }) {
  return document;
}

export function validateDocument({ document }) {
  return validateDoc(document);
}

export function setDatabase({ document, database }) {
  const next = cloneDoc(document);
  next.database = database;
  return withWarnings(next);
}

export function addTable({ document, name, x = 0, y = 0, fields = [] }) {
  const next = cloneDoc(document);
  const id = nanoid();
  next.tables.push(
    normalizeTable({
      id,
      name,
      x,
      y,
      fields: fields.map((field) => normalizeField({ ...field, id: nanoid() })),
    }),
  );
  return withId(next, id);
}

export function updateTable({ document, tableId, patch }) {
  const next = cloneDoc(document);
  Object.assign(findTable(next, tableId), patch);
  return withWarnings(next);
}

export function removeTable({ document, tableId }) {
  const next = cloneDoc(document);
  next.tables = next.tables.filter((table) => table.id !== tableId);
  next.references = next.references.filter(
    (reference) =>
      reference.startTableId !== tableId && reference.endTableId !== tableId,
  );
  return withWarnings(next);
}

export function addField({ document, tableId, field }) {
  const next = cloneDoc(document);
  const table = findTable(next, tableId);
  const id = nanoid();
  table.fields.push(normalizeField({ ...field, id }));
  return withId(next, id);
}

export function updateField({ document, tableId, fieldId, patch }) {
  const next = cloneDoc(document);
  const table = findTable(next, tableId);
  Object.assign(findField(table, fieldId), patch);
  return withWarnings(next);
}

export function removeField({ document, tableId, fieldId }) {
  const next = cloneDoc(document);
  const table = findTable(next, tableId);
  table.fields = table.fields.filter((field) => field.id !== fieldId);
  next.references = next.references.filter((reference) => {
    if (
      reference.startTableId === tableId &&
      reference.startFieldId === fieldId
    ) {
      return false;
    }
    if (reference.endTableId === tableId && reference.endFieldId === fieldId) {
      return false;
    }
    return !(reference.fields ?? []).some(
      (pair) =>
        (reference.startTableId === tableId &&
          pair.startFieldId === fieldId) ||
        (reference.endTableId === tableId && pair.endFieldId === fieldId),
    );
  });
  return withWarnings(next);
}

export function addReference({ document, ref }) {
  const next = cloneDoc(document);
  const id = nanoid();
  const fields = ref.fields ?? [
    {
      startFieldId: ref.startFieldId,
      endFieldId: ref.endFieldId,
    },
  ];
  next.references.push({
    id,
    name: ref.name ?? "",
    startTableId: ref.startTableId,
    startFieldId: ref.startFieldId,
    endTableId: ref.endTableId,
    endFieldId: ref.endFieldId,
    fields,
    updateConstraint: ref.updateConstraint ?? "No action",
    deleteConstraint: ref.deleteConstraint ?? "No action",
    cardinality: ref.cardinality ?? "many_to_one",
  });
  return withId(next, id);
}

export function removeReference({ document, referenceId }) {
  const next = cloneDoc(document);
  next.references = next.references.filter(
    (reference) => reference.id !== referenceId,
  );
  return withWarnings(next);
}

export function addIndex({ document, tableId, index }) {
  const next = cloneDoc(document);
  const table = findTable(next, tableId);
  const id = nanoid();
  table.indices.push({
    id,
    name: index?.name ?? `idx_${id}`,
    unique: false,
    fields: [],
    ...(index ?? {}),
  });
  return withId(next, id);
}

export function addNote({ document, note }) {
  const next = cloneDoc(document);
  const id = nanoid();
  next.notes.push({ id, ...(note ?? {}) });
  return withId(next, id);
}

export function addArea({ document, area }) {
  const next = cloneDoc(document);
  const id = nanoid();
  next.areas.push({ id, ...(area ?? {}) });
  return withId(next, id);
}

export function addType({ document, type }) {
  const next = cloneDoc(document);
  const id = nanoid();
  next.types = Array.isArray(next.types) ? next.types : [];
  next.types.push({ id, ...(type ?? {}) });
  return withId(next, id);
}

export function addEnum({ document, enum: enumValue }) {
  const next = cloneDoc(document);
  const id = nanoid();
  next.enums = Array.isArray(next.enums) ? next.enums : [];
  next.enums.push({ id, ...(enumValue ?? {}) });
  return withId(next, id);
}

function toolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

function registerJsonTool(server, name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async (args) =>
    toolResult(handler(args)),
  );
}

export function registerDocumentTools(server) {
  registerJsonTool(
    server,
    "create_document",
    "Create an empty DrawDB diagram document.",
    z.object({ database: z.string().optional() }),
    createDocument,
  );
  registerJsonTool(
    server,
    "get_document",
    "Return the supplied DrawDB diagram document.",
    z.object({ document: DocumentInputSchema }),
    getDocument,
  );
  registerJsonTool(
    server,
    "validate_document",
    "Validate a DrawDB diagram document and return warnings.",
    z.object({ document: DocumentInputSchema }),
    validateDocument,
  );
  registerJsonTool(
    server,
    "set_database",
    "Set the document database dialect.",
    z.object({ document: DocumentInputSchema, database: z.string() }),
    setDatabase,
  );
  registerJsonTool(
    server,
    "add_table",
    "Add a table to a DrawDB diagram document.",
    z.object({
      document: DocumentInputSchema,
      name: z.string(),
      x: z.number().optional(),
      y: z.number().optional(),
      fields: z.array(FieldInputSchema).optional(),
    }),
    addTable,
  );
  registerJsonTool(
    server,
    "update_table",
    "Patch a table in a DrawDB diagram document.",
    z.object({
      document: DocumentInputSchema,
      tableId: z.string(),
      patch: PatchSchema,
    }),
    updateTable,
  );
  registerJsonTool(
    server,
    "remove_table",
    "Remove a table and references touching it.",
    z.object({ document: DocumentInputSchema, tableId: z.string() }),
    removeTable,
  );
  registerJsonTool(
    server,
    "add_field",
    "Add a field to a table.",
    z.object({
      document: DocumentInputSchema,
      tableId: z.string(),
      field: FieldInputSchema,
    }),
    addField,
  );
  registerJsonTool(
    server,
    "update_field",
    "Patch a field in a table.",
    z.object({
      document: DocumentInputSchema,
      tableId: z.string(),
      fieldId: z.string(),
      patch: PatchSchema,
    }),
    updateField,
  );
  registerJsonTool(
    server,
    "remove_field",
    "Remove a field and references touching it.",
    z.object({
      document: DocumentInputSchema,
      tableId: z.string(),
      fieldId: z.string(),
    }),
    removeField,
  );
  registerJsonTool(
    server,
    "add_reference",
    "Add a foreign-key reference.",
    z.object({ document: DocumentInputSchema, ref: ReferenceInputSchema }),
    addReference,
  );
  registerJsonTool(
    server,
    "remove_reference",
    "Remove a foreign-key reference.",
    z.object({ document: DocumentInputSchema, referenceId: z.string() }),
    removeReference,
  );
  registerJsonTool(
    server,
    "add_index",
    "Add an index to a table.",
    z.object({
      document: DocumentInputSchema,
      tableId: z.string(),
      index: z.record(z.any()),
    }),
    addIndex,
  );
  registerJsonTool(
    server,
    "add_note",
    "Add a note to the document.",
    z.object({ document: DocumentInputSchema, note: z.record(z.any()) }),
    addNote,
  );
  registerJsonTool(
    server,
    "add_area",
    "Add an area to the document.",
    z.object({ document: DocumentInputSchema, area: z.record(z.any()) }),
    addArea,
  );
  registerJsonTool(
    server,
    "add_type",
    "Add a custom type to the document.",
    z.object({ document: DocumentInputSchema, type: z.record(z.any()) }),
    addType,
  );
  registerJsonTool(
    server,
    "add_enum",
    "Add an enum to the document.",
    z.object({ document: DocumentInputSchema, enum: z.record(z.any()) }),
    addEnum,
  );
}
