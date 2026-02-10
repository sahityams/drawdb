import { escapeQuotes, exportFieldComment, parseDefault } from "./shared";
import { dbToTypes } from "../../data/datatypes";

export function toSnowflake(diagram) {
  const tableStatements = diagram.tables
    .map((table) => {
      const fieldDefinitions = table.fields
        .map(
          (field) =>
            `${exportFieldComment(field.comment)}\t"${
              field.name
            }" ${field.type}${
              field.size ? `(${field.size})` : ""
            }${field.notNull ? " NOT NULL" : ""}${
              field.unique ? " UNIQUE" : ""
            }${
              field.increment
                ? " AUTOINCREMENT"
                : ""
            }${
              field.default?.trim()
                ? ` DEFAULT ${parseDefault(field, diagram.database)}`
                : ""
            }${
              field.check && dbToTypes[diagram.database][field.type]?.hasCheck
                ? ` CHECK(${field.check})`
                : ""
            }`,
        )
        .join(",\n");

      const primaryKeyClause = table.fields.some((f) => f.primary)
        ? `,\n\tPRIMARY KEY(${table.fields
            .filter((f) => f.primary)
            .map((f) => `"${f.name}"`)
            .join(", ")})`
        : "";

      const commentStatements = [
        table.comment?.trim()
          ? `COMMENT ON TABLE "${table.name}" IS '${escapeQuotes(table.comment)}';`
          : "",
        ...table.fields
          .map((field) =>
            field.comment?.trim()
              ? `COMMENT ON COLUMN "${table.name}"."${field.name}" IS '${escapeQuotes(field.comment)}';`
              : "",
          )
          .filter(Boolean),
      ].join("\n");

      const indexStatements = table.indices
        .map(
          (i) =>
            `CREATE ${i.unique ? "UNIQUE " : ""}INDEX "${i.name}"\nON "${table.name}" (${i.fields
              .map((f) => `"${f}"`)
              .join(", ")});`,
        )
        .join("\n");

      return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${fieldDefinitions}${primaryKeyClause}\n);\n\n${commentStatements}\n${indexStatements}`;
    })
    .join("\n\n");

  const foreignKeyStatements = diagram.references
    .map((r) => {
      const startTable = diagram.tables.find((t) => t.id === r.startTableId);
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      const startField = startTable?.fields.find(
        (f) => f.id === r.startFieldId,
      );
      const endField = endTable?.fields.find((f) => f.id === r.endFieldId);

      if (!startTable || !endTable || !startField || !endField) return "";

      return `ALTER TABLE "${startTable.name}"\nADD FOREIGN KEY("${startField.name}") REFERENCES "${endTable.name}"("${endField.name}")\nON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`;
    })
    .filter(Boolean)
    .join("\n");

  return [tableStatements, foreignKeyStatements].filter(Boolean).join("\n");
}
