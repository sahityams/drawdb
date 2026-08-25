import { emptyDoc, nanoid, validateDoc } from "../doc/model.mjs";
import { dbToTypes } from "../generated/drawdb-core.mjs";

const SNOWFLAKE_DATABASE = "snowflake";
const FALLBACK_TYPE = "VARCHAR";

const TYPE_ALIASES = {
  FIXED: "NUMBER",
  TEXT: "VARCHAR",
  STRING: "VARCHAR",
  "DOUBLE PRECISION": "DOUBLE PRECISION",
  "TIMESTAMP WITH LOCAL TIME ZONE": "TIMESTAMP_LTZ",
  "TIMESTAMP WITHOUT TIME ZONE": "TIMESTAMP_NTZ",
  "TIMESTAMP WITH TIME ZONE": "TIMESTAMP_TZ",
};

function value(row, key) {
  return row?.[key] ?? row?.[key.toUpperCase()] ?? row?.[key.toLowerCase()];
}

function normalizeName(name) {
  return String(name ?? "").trim();
}

function normalizeTypeName(dataType) {
  return normalizeName(dataType).replace(/\s+/g, " ").toUpperCase();
}

function normalizeConstraint(rule) {
  switch (normalizeName(rule).replace(/_/g, " ").toUpperCase()) {
    case "CASCADE":
      return "Cascade";
    case "RESTRICT":
      return "Restrict";
    case "SET NULL":
      return "Set null";
    case "SET DEFAULT":
      return "Set default";
    default:
      return "No action";
  }
}

function columnPosition(row) {
  const position = Number(value(row, "ordinal_position"));
  return Number.isFinite(position) ? position : 0;
}

function keySequence(row) {
  const sequence = Number(
    value(row, "key_sequence") ?? value(row, "ordinal_position"),
  );
  return Number.isFinite(sequence) ? sequence : 0;
}

function makePrimaryKeySet(primaryKeys) {
  return new Set(
    primaryKeys
      .map((row) => `${normalizeName(value(row, "table_name"))}.${normalizeName(value(row, "column_name"))}`)
      .filter((key) => key !== "."),
  );
}

function resolveType(row, warnings) {
  const rawType = normalizeTypeName(value(row, "data_type"));
  const typeName = TYPE_ALIASES[rawType] ?? rawType;
  const snowflakeTypes = dbToTypes[SNOWFLAKE_DATABASE] ?? {};

  if (snowflakeTypes[typeName]) {
    return typeName;
  }

  warnings.push(
    `Unknown Snowflake type "${rawType || "<empty>"}" on "${normalizeName(
      value(row, "table_name"),
    )}.${normalizeName(value(row, "column_name"))}"; mapped to ${FALLBACK_TYPE}.`,
  );
  return FALLBACK_TYPE;
}

function resolveSize(row, typeName) {
  if (["VARCHAR", "CHAR", "CHARACTER", "BINARY", "VARBINARY"].includes(typeName)) {
    return value(row, "character_maximum_length") ?? "";
  }

  if (["NUMBER", "DECIMAL", "NUMERIC"].includes(typeName)) {
    const precision = value(row, "numeric_precision");
    const scale = value(row, "numeric_scale");
    if (precision === undefined || precision === null || precision === "") {
      return "";
    }
    if (scale === undefined || scale === null || scale === "" || Number(scale) === 0) {
      return precision;
    }
    return `${precision},${scale}`;
  }

  return "";
}

function makeField(row, primaryKeys, warnings) {
  const tableName = normalizeName(value(row, "table_name"));
  const columnName = normalizeName(value(row, "column_name"));
  const type = resolveType(row, warnings);

  return {
    id: nanoid(),
    name: columnName,
    type,
    primary: primaryKeys.has(`${tableName}.${columnName}`),
    unique: false,
    notNull: normalizeName(value(row, "is_nullable")).toUpperCase() === "NO",
    increment: false,
    default: normalizeName(value(row, "column_default")),
    check: "",
    comment: normalizeName(value(row, "comment")),
    size: resolveSize(row, type),
  };
}

function makeReferenceGroups(foreignKeys) {
  const groups = new Map();

  for (const row of foreignKeys) {
    const fkTable = normalizeName(value(row, "fk_table"));
    const pkTable = normalizeName(value(row, "pk_table"));
    const constraintName = normalizeName(value(row, "constraint_name")) ||
      `fk_${fkTable}_${pkTable}`;
    const groupKey = `${constraintName}.${fkTable}.${pkTable}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        constraintName,
        fkTable,
        pkTable,
        updateRule: value(row, "update_rule"),
        deleteRule: value(row, "delete_rule"),
        rows: [],
      });
    }

    groups.get(groupKey).rows.push(row);
  }

  return [...groups.values()];
}

/**
 * Build a canonical DrawDB document from already-fetched Snowflake metadata.
 *
 * Expected row shapes use lower-case keys; Snowflake/driver upper-case keys are
 * accepted too:
 * - columns: { table_name, column_name, data_type, is_nullable,
 *   character_maximum_length, numeric_precision, numeric_scale,
 *   ordinal_position, column_default?, comment? }
 * - primaryKeys: { table_name, column_name }
 * - foreignKeys: { fk_table, fk_column, pk_table, pk_column, constraint_name,
 *   key_sequence?, update_rule?, delete_rule? }
 */
export function buildDocumentFromMetadata({
  columns = [],
  primaryKeys = [],
  foreignKeys = [],
  schema,
} = {}) {
  const warnings = [];
  const document = {
    ...emptyDoc(SNOWFLAKE_DATABASE),
    title: schema ? `${schema} schema` : "Snowflake schema",
  };
  const pkSet = makePrimaryKeySet(primaryKeys);
  const tableByName = new Map();
  const fieldByTableAndColumn = new Map();

  const sortedColumns = [...columns].sort((a, b) => {
    const tableCompare = normalizeName(value(a, "table_name")).localeCompare(
      normalizeName(value(b, "table_name")),
    );
    return tableCompare || columnPosition(a) - columnPosition(b);
  });

  for (const columnRow of sortedColumns) {
    const tableName = normalizeName(value(columnRow, "table_name"));
    const columnName = normalizeName(value(columnRow, "column_name"));
    if (!tableName || !columnName) {
      warnings.push("Skipped a column metadata row without table_name or column_name.");
      continue;
    }

    if (!tableByName.has(tableName)) {
      const table = {
        id: nanoid(),
        name: tableName,
        x: document.tables.length * 260,
        y: 0,
        comment: "",
        fields: [],
        indices: [],
        uniqueConstraints: [],
      };
      tableByName.set(tableName, table);
      document.tables.push(table);
    }

    const field = makeField(columnRow, pkSet, warnings);
    tableByName.get(tableName).fields.push(field);
    fieldByTableAndColumn.set(`${tableName}.${columnName}`, field);
  }

  for (const group of makeReferenceGroups(foreignKeys)) {
    const startTable = tableByName.get(group.fkTable);
    const endTable = tableByName.get(group.pkTable);
    if (!startTable || !endTable) {
      warnings.push(
        `Skipped foreign key "${group.constraintName}" because a referenced table was not present in column metadata.`,
      );
      continue;
    }

    const pairs = group.rows
      .sort((a, b) => keySequence(a) - keySequence(b))
      .map((row) => {
        const fkColumn = normalizeName(value(row, "fk_column"));
        const pkColumn = normalizeName(value(row, "pk_column"));
        return {
          startField: fieldByTableAndColumn.get(`${group.fkTable}.${fkColumn}`),
          endField: fieldByTableAndColumn.get(`${group.pkTable}.${pkColumn}`),
          fkColumn,
          pkColumn,
        };
      });

    const missingPair = pairs.find((pair) => !pair.startField || !pair.endField);
    if (missingPair) {
      warnings.push(
        `Skipped foreign key "${group.constraintName}" because column "${missingPair.fkColumn}" or "${missingPair.pkColumn}" was not present in column metadata.`,
      );
      continue;
    }

    document.references.push({
      id: nanoid(),
      name: group.constraintName,
      startTableId: startTable.id,
      startFieldId: pairs[0].startField.id,
      endTableId: endTable.id,
      endFieldId: pairs[0].endField.id,
      fields: pairs.map((pair) => ({
        startFieldId: pair.startField.id,
        endFieldId: pair.endField.id,
      })),
      updateConstraint: normalizeConstraint(group.updateRule),
      deleteConstraint: normalizeConstraint(group.deleteRule),
      cardinality: "many_to_one",
    });
  }

  const validation = validateDoc(document);
  return {
    document,
    warnings: [...warnings, ...validation.warnings],
  };
}
