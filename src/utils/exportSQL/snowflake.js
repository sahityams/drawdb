import {
  escapeQuotes,
  parseDefault,
  uniqueConstraintClause,
  getFkColumnNames,
} from "./shared";
import { dbToTypes } from "../../data/datatypes";
import { DB } from "../../data/constants";

// Snowflake column type, with size only for sized/precision types.
function parseType(field) {
  const typeInfo = dbToTypes[DB.SNOWFLAKE][field.type];
  const sized =
    (typeInfo?.isSized || typeInfo?.hasPrecision) &&
    field.size !== undefined &&
    field.size !== null &&
    field.size !== "";
  return `${field.type}${sized ? `(${field.size})` : ""}`;
}

// Column definition. Snowflake notes vs. other dialects:
//  - No CHECK constraints (Snowflake does not support them), so none is emitted.
//  - Identity columns use AUTOINCREMENT, only valid on numeric types.
//  - Column comments use the inline COMMENT clause (Snowflake-native).
function fieldToDDL(field) {
  const typeInfo = dbToTypes[DB.SNOWFLAKE][field.type];
  return `\t"${field.name}" ${parseType(field)}${
    field.notNull ? " NOT NULL" : ""
  }${field.increment && typeInfo?.canIncrement ? " AUTOINCREMENT" : ""}${
    field.unique ? " UNIQUE" : ""
  }${
    String(field.default ?? "").trim()
      ? ` DEFAULT ${parseDefault(field, DB.SNOWFLAKE)}`
      : ""
  }${
    field.comment?.trim() ? ` COMMENT '${escapeQuotes(field.comment)}'` : ""
  }`;
}

export function toSnowflake(diagram) {
  const tableStatements = diagram.tables
    .map((table) => {
      const fieldDefinitions = table.fields.map(fieldToDDL).join(",\n");

      const primaryKeyClause = table.fields.some((f) => f.primary)
        ? `,\n\tPRIMARY KEY(${table.fields
            .filter((f) => f.primary)
            .map((f) => `"${f.name}"`)
            .join(", ")})`
        : "";

      const uniqueClause = uniqueConstraintClause(table, (s) => `"${s}"`);

      // Snowflake table comment is an inline option, not a COMMENT ON statement.
      const tableComment = table.comment?.trim()
        ? ` COMMENT = '${escapeQuotes(table.comment)}'`
        : "";

      // Snowflake standard tables do not support CREATE INDEX; indices are
      // intentionally omitted so the generated DDL stays valid.
      return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${fieldDefinitions}${primaryKeyClause}${uniqueClause}\n)${tableComment};`;
    })
    .join("\n\n");

  const foreignKeyStatements = diagram.references
    .map((r) => {
      const startTable = diagram.tables.find((t) => t.id === r.startTableId);
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      if (!startTable || !endTable) return "";

      const { startColumns, endColumns } = getFkColumnNames(
        r,
        startTable,
        endTable,
      );
      if (startColumns.some((c) => !c) || endColumns.some((c) => !c)) return "";

      return `ALTER TABLE "${startTable.name}"\nADD FOREIGN KEY(${startColumns
        .map((c) => `"${c}"`)
        .join(", ")}) REFERENCES "${endTable.name}"(${endColumns
        .map((c) => `"${c}"`)
        .join(
          ", ",
        )})\nON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`;
    })
    .filter(Boolean)
    .join("\n");

  return [tableStatements, foreignKeyStatements]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}
