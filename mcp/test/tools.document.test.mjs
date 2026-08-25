import { describe, expect, it } from "vitest";
import {
  addField,
  addReference,
  addTable,
  createDocument,
} from "../src/tools/document.mjs";
import { renderSql } from "../src/tools/features.mjs";

function addBasicTable(document, name) {
  const tableResult = addTable({ document, name });
  document = tableResult.document;
  const tableId = tableResult.id;

  const idResult = addField({
    document,
    tableId,
    field: {
      name: "id",
      type: "NUMBER",
      primary: true,
      notNull: true,
    },
  });

  return {
    document: idResult.document,
    tableId,
    idFieldId: idResult.id,
  };
}

describe("document tools", () => {
  it("creates, mutates, and renders a document with a foreign key", () => {
    let document = createDocument({ database: "snowflake" });

    const users = addBasicTable(document, "users");
    document = users.document;

    const email = addField({
      document,
      tableId: users.tableId,
      field: {
        name: "email",
        type: "VARCHAR",
        size: 255,
        unique: true,
        notNull: true,
      },
    });
    document = email.document;

    const orders = addBasicTable(document, "orders");
    document = orders.document;

    const userId = addField({
      document,
      tableId: orders.tableId,
      field: {
        name: "user_id",
        type: "NUMBER",
        notNull: true,
      },
    });
    document = userId.document;

    const reference = addReference({
      document,
      ref: {
        name: "fk_orders_user_id_users",
        startTableId: orders.tableId,
        startFieldId: userId.id,
        endTableId: users.tableId,
        endFieldId: users.idFieldId,
        deleteConstraint: "Cascade",
      },
    });
    document = reference.document;

    expect(reference.id).toEqual(expect.any(String));
    expect(reference.warnings).toEqual([]);
    expect(document.references).toHaveLength(1);
    expect(document.references[0].fields).toEqual([
      { startFieldId: userId.id, endFieldId: users.idFieldId },
    ]);

    const { sql } = renderSql({ document, dialect: "snowflake" });

    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('CREATE TABLE "orders"');
    expect(sql).toContain(
      'FOREIGN KEY("user_id") REFERENCES "users"("id")',
    );
  });
});
