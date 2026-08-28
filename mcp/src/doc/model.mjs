import { nanoid } from "nanoid";
import { z } from "zod";
import { dbToTypes } from "../generated/drawdb-core.mjs";

const IdSchema = z.string().min(1);
const StringOrNumberSchema = z.union([z.string(), z.number()]);

export const FieldSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: z.string(),
  primary: z.boolean(),
  unique: z.boolean(),
  notNull: z.boolean(),
  increment: z.boolean(),
  default: z.string(),
  check: z.string(),
  comment: z.string(),
  size: StringOrNumberSchema.optional().default(""),
});

export const TableSchema = z.object({
  id: IdSchema,
  name: z.string(),
  comment: z.string(),
  color: z.string().optional(),
  fields: z.array(FieldSchema),
  indices: z.array(z.unknown()),
  uniqueConstraints: z.array(z.unknown()),
});

export const ReferenceSchema = z.object({
  id: IdSchema,
  name: z.string(),
  startTableId: IdSchema,
  startFieldId: IdSchema,
  endTableId: IdSchema,
  endFieldId: IdSchema,
  fields: z.array(
    z.object({
      startFieldId: IdSchema,
      endFieldId: IdSchema,
    }),
  ),
  updateConstraint: z.string(),
  deleteConstraint: z.string(),
  cardinality: z.string(),
});

export const DocumentSchema = z.object({
  database: z.string(),
  title: z.string(),
  tables: z.array(TableSchema),
  references: z.array(ReferenceSchema),
  notes: z.array(z.unknown()),
  areas: z.array(z.unknown()),
  pan: z.object({
    x: z.number(),
    y: z.number(),
  }),
  zoom: z.number(),
  enums: z.array(z.unknown()).optional(),
  types: z.array(z.unknown()).optional(),
});

export function emptyDoc(database = "generic") {
  return {
    database,
    title: "Untitled",
    tables: [],
    references: [],
    notes: [],
    areas: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
    enums: [],
    types: [],
  };
}

export function validateDoc(document) {
  const warnings = [];
  const tables = Array.isArray(document?.tables) ? document.tables : [];
  const references = Array.isArray(document?.references)
    ? document.references
    : [];
  const database = typeof document?.database === "string"
    ? document.database
    : "";
  const dialectTypes = database ? dbToTypes[database] : false;

  const tableIds = new Set();
  const duplicateTableIds = new Set();
  const tableById = new Map();
  const fieldsByTableId = new Map();

  for (const table of tables) {
    const tableId = table?.id;
    if (typeof tableId === "string") {
      if (tableIds.has(tableId)) {
        duplicateTableIds.add(tableId);
      } else {
        tableIds.add(tableId);
      }
      if (!tableById.has(tableId)) {
        tableById.set(tableId, table);
      }
    }

    const fieldIds = new Set();
    const duplicateFieldIds = new Set();
    const fieldsById = new Map();
    const fields = Array.isArray(table?.fields) ? table.fields : [];

    for (const field of fields) {
      const fieldId = field?.id;
      if (typeof fieldId === "string") {
        if (fieldIds.has(fieldId)) {
          duplicateFieldIds.add(fieldId);
        } else {
          fieldIds.add(fieldId);
        }
        if (!fieldsById.has(fieldId)) {
          fieldsById.set(fieldId, field);
        }
      }

      if (typeof field?.type === "string") {
        const typeName = field.type.toUpperCase();
        if (!dialectTypes || !dialectTypes[typeName]) {
          warnings.push(
            `Unknown type "${field.type}" for dialect "${database}" on field "${field?.name ?? fieldId ?? "<unknown>"}".`,
          );
        }
      }
    }

    for (const duplicateFieldId of duplicateFieldIds) {
      warnings.push(
        `Duplicate field id "${duplicateFieldId}" within table "${table?.name ?? tableId ?? "<unknown>"}".`,
      );
    }

    if (typeof tableId === "string") {
      fieldsByTableId.set(tableId, fieldsById);
    }
  }

  for (const duplicateTableId of duplicateTableIds) {
    warnings.push(`Duplicate table id "${duplicateTableId}".`);
  }

  for (const reference of references) {
    const missing = [];
    const startFields = fieldsByTableId.get(reference?.startTableId);
    const endFields = fieldsByTableId.get(reference?.endTableId);

    if (!tableById.has(reference?.startTableId)) {
      missing.push(`startTableId "${reference?.startTableId}"`);
    }
    if (!tableById.has(reference?.endTableId)) {
      missing.push(`endTableId "${reference?.endTableId}"`);
    }
    if (!startFields?.has(reference?.startFieldId)) {
      missing.push(`startFieldId "${reference?.startFieldId}"`);
    }
    if (!endFields?.has(reference?.endFieldId)) {
      missing.push(`endFieldId "${reference?.endFieldId}"`);
    }

    const fieldPairs = Array.isArray(reference?.fields) ? reference.fields : [];
    for (const [index, fieldPair] of fieldPairs.entries()) {
      if (!startFields?.has(fieldPair?.startFieldId)) {
        missing.push(`fields[${index}].startFieldId "${fieldPair?.startFieldId}"`);
      }
      if (!endFields?.has(fieldPair?.endFieldId)) {
        missing.push(`fields[${index}].endFieldId "${fieldPair?.endFieldId}"`);
      }
    }

    if (missing.length > 0) {
      warnings.push(
        `Dangling reference "${reference?.name ?? reference?.id ?? "<unknown>"}": ${missing.join(", ")}.`,
      );
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}

export { nanoid };
