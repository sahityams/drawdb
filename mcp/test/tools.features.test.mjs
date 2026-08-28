import { describe, expect, it } from "vitest";
import {
  addField,
  addReference,
  addTable,
  createDocument,
} from "../src/tools/document.mjs";
import {
  importSql,
  renderDbml,
  renderDocumentation,
  renderMermaid,
  renderSql,
} from "../src/tools/features.mjs";

function snowflakeSchema() {
  let document = createDocument({ database: "snowflake" });

  let result = addTable({ document, name: "users" });
  document = result.document;
  const usersTableId = result.id;

  result = addField({
    document,
    tableId: usersTableId,
    field: {
      name: "id",
      type: "NUMBER",
      primary: true,
      notNull: true,
    },
  });
  document = result.document;
  const usersIdFieldId = result.id;

  result = addField({
    document,
    tableId: usersTableId,
    field: {
      name: "email",
      type: "VARCHAR",
      size: 255,
      unique: true,
      notNull: true,
    },
  });
  document = result.document;

  result = addTable({ document, name: "orders" });
  document = result.document;
  const ordersTableId = result.id;

  result = addField({
    document,
    tableId: ordersTableId,
    field: {
      name: "id",
      type: "NUMBER",
      primary: true,
      notNull: true,
    },
  });
  document = result.document;

  result = addField({
    document,
    tableId: ordersTableId,
    field: {
      name: "user_id",
      type: "NUMBER",
      notNull: true,
    },
  });
  document = result.document;
  const ordersUserIdFieldId = result.id;

  result = addReference({
    document,
    ref: {
      name: "fk_orders_user_id_users",
      startTableId: ordersTableId,
      startFieldId: ordersUserIdFieldId,
      endTableId: usersTableId,
      endFieldId: usersIdFieldId,
      deleteConstraint: "Cascade",
    },
  });

  return result.document;
}

describe("feature tools", () => {
  it("renders DBML, Mermaid, and documentation using canonical references", () => {
    const document = snowflakeSchema();

    const { dbml } = renderDbml({ document });
    const { mermaid } = renderMermaid({ document });
    const { markdown } = renderDocumentation({ document });

    expect(dbml).toContain("Table");
    expect(dbml).toContain("Ref");
    expect(mermaid).toContain("erDiagram");
    expect(mermaid).toContain("}o--||");
    expect(markdown).toContain("## Table structure");
    expect(markdown).toContain("fk_orders_user_id_users");
  });

  it("imports rendered Snowflake SQL as a canonical document with references", () => {
    const document = snowflakeSchema();
    const { sql } = renderSql({ document, dialect: "snowflake" });

    const imported = importSql({ sql, dialect: "snowflake" });

    expect(imported.warnings).toEqual([]);
    expect(imported.document.database).toBe("snowflake");
    expect(imported.document).not.toHaveProperty("relationships");
    expect(imported.document.tables.map((table) => table.name).sort()).toEqual([
      "orders",
      "users",
    ]);
    expect(imported.document.references).toHaveLength(1);
    expect(imported.document.references[0].fields).toEqual([
      {
        startFieldId: imported.document.references[0].startFieldId,
        endFieldId: imported.document.references[0].endFieldId,
      },
    ]);
  });
});
