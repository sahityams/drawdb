import { nanoid } from "nanoid";
import { Cardinality, Constraint, DB } from "../../data/constants";
import { dbToTypes } from "../../data/datatypes";
import { findReferencedTable } from "./shared";

// node-sql-parser's snowflake dialect emits column references as a plain
// string (`column_ref.column`); older shapes nested it under `.expr.value`.
// Accept both so the importer is resilient across parser versions.
function columnName(ref) {
  return ref?.column?.expr?.value ?? ref?.column;
}

// Normalize a few Snowflake type spellings onto the canonical dbToTypes keys.
const affinity = {
  [DB.SNOWFLAKE]: new Proxy(
    {
      FIXED: "NUMBER",
      TEXT: "VARCHAR",
      STRING: "VARCHAR",
      "CHARACTER VARYING": "VARCHAR",
    },
    { get: (target, prop) => (prop in target ? target[prop] : "VARCHAR") },
  ),
  [DB.GENERIC]: new Proxy(
    {
      INTEGER: "INT",
      "CHARACTER VARYING": "VARCHAR",
      "DOUBLE PRECISION": "DOUBLE",
    },
    { get: (target, prop) => (prop in target ? target[prop] : "BLOB") },
  ),
};

function resolveType(dataType, diagramDb) {
  const upper = String(dataType ?? "").toUpperCase();
  const map = affinity[diagramDb] ?? affinity[DB.GENERIC];
  return dbToTypes[diagramDb]?.[upper]?.type ?? map[upper];
}

function parseDefaultValue(defaultVal) {
  const value = defaultVal?.value;
  if (!value) return "";
  switch (value.type) {
    case "single_quote_string":
    case "double_quote_string":
      return value.value;
    case "null":
      return "NULL";
    case "cast":
      return value.expr?.value?.toString() ?? "";
    case "function": {
      let out = value.name?.name?.[0]?.value ?? "";
      if (value.args) {
        const args = (value.args.value ?? [])
          .map((v) =>
            v.type === "single_quote_string" || v.type === "double_quote_string"
              ? `'${v.value}'`
              : v.value,
          )
          .join(", ");
        out += `(${args})`;
      }
      return out;
    }
    default:
      return value.value?.toString() ?? "";
  }
}

function fieldSize(definition) {
  if (definition?.length === undefined || definition?.length === null) return "";
  return definition.scale
    ? `${definition.length},${definition.scale}`
    : `${definition.length}`;
}

function makeRelationship(startTable, endTable, fieldPairs, onAction) {
  let updateConstraint = Constraint.NONE;
  let deleteConstraint = Constraint.NONE;
  (onAction ?? []).forEach((c) => {
    const v = c.value?.value;
    if (!v) return;
    const cap = v[0].toUpperCase() + v.substring(1);
    if (c.type === "on update") updateConstraint = cap;
    else if (c.type === "on delete") deleteConstraint = cap;
  });

  const startField = startTable.fields.find(
    (f) => f.id === fieldPairs[0].startFieldId,
  );

  return {
    id: nanoid(),
    name: `fk_${startTable.name}_${startField?.name}_${endTable.name}`,
    startTableId: startTable.id,
    startFieldId: fieldPairs[0].startFieldId,
    endTableId: endTable.id,
    endFieldId: fieldPairs[0].endFieldId,
    fields: fieldPairs,
    updateConstraint,
    deleteConstraint,
    cardinality: startField?.unique
      ? Cardinality.ONE_TO_ONE
      : Cardinality.MANY_TO_ONE,
  };
}

// Resolve start/end column-name pairs into field-id pairs; returns null if any
// column can't be resolved (so the caller can skip an incomplete FK).
function resolveFieldPairs(startTable, endTable, startNames, endNames) {
  const pairs = [];
  for (let i = 0; i < startNames.length; i++) {
    const sf = startTable.fields.find((f) => f.name === startNames[i]);
    const ef = endTable.fields.find((f) => f.name === endNames[i]);
    if (!sf || !ef) return null;
    pairs.push({ startFieldId: sf.id, endFieldId: ef.id });
  }
  return pairs.length === startNames.length ? pairs : null;
}

export function fromSnowflake(ast, diagramDb = DB.SNOWFLAKE) {
  const tables = [];
  const relationships = [];
  // FKs whose referenced table may not be parsed yet are deferred.
  const pendingReferences = [];

  const parseCreateTable = (e) => {
    const table = {
      id: nanoid(),
      name: e.table[0].table,
      comment: "",
      color: "#175e7a",
      fields: [],
      indices: [],
      uniqueConstraints: [],
    };

    // Table comment from the COMMENT = '...' table option.
    const commentOption = (e.table_options ?? []).find(
      (o) => o.keyword === "comment",
    );
    if (commentOption) {
      table.comment = String(commentOption.value ?? "").replace(/^'|'$/g, "");
    }

    (e.create_definitions ?? []).forEach((d) => {
      if (d.resource === "column") {
        const field = {
          id: nanoid(),
          name: columnName(d.column),
          type: resolveType(d.definition?.dataType, diagramDb),
          notNull: d.nullable?.value === "not null",
          unique: d.unique === "unique",
          primary: Boolean(d.primary_key),
          increment: Boolean(d.auto_increment),
          default: d.default_val ? parseDefaultValue(d.default_val) : "",
          check: "",
          comment: d.comment?.value?.value ?? "",
          size: fieldSize(d.definition),
        };
        table.fields.push(field);

        // Column-level inline foreign key.
        if (d.reference_definition) {
          pendingReferences.push({
            startTableId: table.id,
            startFieldNames: [field.name],
            endTableName: d.reference_definition.table[0].table,
            endFieldNames: d.reference_definition.definition.map(columnName),
            onAction: d.reference_definition.on_action,
          });
        }
      } else if (d.resource === "constraint") {
        const type = d.constraint_type?.toLowerCase();
        if (type === "primary key") {
          d.definition.forEach((c) => {
            const name = columnName(c);
            const f = table.fields.find((x) => x.name === name);
            if (f) f.primary = true;
          });
        } else if (type === "foreign key") {
          pendingReferences.push({
            startTableId: table.id,
            startFieldNames: d.definition.map(columnName),
            endTableName: d.reference_definition.table[0].table,
            endFieldNames: d.reference_definition.definition.map(columnName),
            onAction: d.reference_definition.on_action,
          });
        } else if (type?.includes("unique")) {
          const fields = d.definition.map(columnName);
          const name =
            d.constraint ||
            d.index ||
            `${table.name}_unique_${table.uniqueConstraints.length}`;
          table.uniqueConstraints.push({ name, fields });
          table.uniqueConstraints.forEach((u, j) => {
            u.id = j;
          });
        }
      }
      // No CHECK handling: Snowflake does not support CHECK constraints and the
      // snowflake parser cannot produce a check node, so there is nothing to read.
    });

    tables.push(table);
  };

  const parseAlter = (e) => {
    (e.expr ?? []).forEach((expr) => {
      if (
        expr.action === "add" &&
        expr.create_definitions?.constraint_type?.toLowerCase() ===
          "foreign key"
      ) {
        const def = expr.create_definitions;
        pendingReferences.push({
          startTableName: e.table[0].table,
          startFieldNames: def.definition.map(columnName),
          endTableName: def.reference_definition.table[0].table,
          endFieldNames: def.reference_definition.definition.map(columnName),
          onAction: def.reference_definition.on_action,
        });
      }
    });
  };

  const parseIndex = (e) => {
    const table = tables.find((t) => t.name === e.table?.table);
    if (!table) return;
    table.indices.push({
      name: e.index,
      unique: e.index_type === "unique",
      fields: (e.index_columns ?? []).map((f) => columnName(f)),
    });
    table.indices.forEach((i, j) => {
      i.id = j;
    });
  };

  const parseSingleStatement = (e) => {
    if (e.type === "create" && e.keyword === "table") parseCreateTable(e);
    else if (e.type === "create" && e.keyword === "index") parseIndex(e);
    else if (e.type === "alter") parseAlter(e);
  };

  if (Array.isArray(ast)) ast.forEach(parseSingleStatement);
  else parseSingleStatement(ast);

  // Resolve deferred foreign keys once every table exists.
  for (const ref of pendingReferences) {
    const startTable = ref.startTableId
      ? tables.find((t) => t.id === ref.startTableId)
      : tables.find((t) => t.name === ref.startTableName);
    if (!startTable) continue;

    const endTable = findReferencedTable(tables, startTable, ref.endTableName);
    if (!endTable) continue;

    const fieldPairs = resolveFieldPairs(
      startTable,
      endTable,
      ref.startFieldNames,
      ref.endFieldNames,
    );
    if (!fieldPairs) continue;

    relationships.push(
      makeRelationship(startTable, endTable, fieldPairs, ref.onAction),
    );
  }

  return { tables, relationships, types: [], enums: [] };
}
