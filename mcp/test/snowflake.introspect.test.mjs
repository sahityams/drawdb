import { describe, expect, it } from "vitest";
import { validateDoc } from "../src/doc/model.mjs";
import { buildDocumentFromMetadata } from "../src/snowflake/introspect.mjs";

const columns = [
  {
    table_name: "users",
    column_name: "id",
    data_type: "NUMBER",
    is_nullable: "NO",
    numeric_precision: 38,
    numeric_scale: 0,
    ordinal_position: 1,
  },
  {
    table_name: "users",
    column_name: "email",
    data_type: "VARCHAR",
    is_nullable: "YES",
    character_maximum_length: 255,
    ordinal_position: 2,
  },
  {
    table_name: "orders",
    column_name: "id",
    data_type: "NUMBER",
    is_nullable: "NO",
    numeric_precision: 38,
    numeric_scale: 0,
    ordinal_position: 1,
  },
  {
    table_name: "orders",
    column_name: "user_id",
    data_type: "NUMBER",
    is_nullable: "NO",
    numeric_precision: 38,
    numeric_scale: 0,
    ordinal_position: 2,
  },
];

const primaryKeys = [
  { table_name: "users", column_name: "id" },
  { table_name: "orders", column_name: "id" },
];

const foreignKeys = [
  {
    fk_table: "orders",
    fk_column: "user_id",
    pk_table: "users",
    pk_column: "id",
    constraint_name: "fk_orders_user_id_users",
    key_sequence: 1,
  },
];

function findTable(document, name) {
  return document.tables.find((table) => table.name === name);
}

function findField(table, name) {
  return table.fields.find((field) => field.name === name);
}

describe("Snowflake metadata introspection", () => {
  it("builds a valid canonical document with primary keys and a foreign key", () => {
    const { document, warnings } = buildDocumentFromMetadata({
      columns,
      primaryKeys,
      foreignKeys,
      schema: "PUBLIC",
    });

    expect(warnings).toEqual([]);
    expect(document.database).toBe("snowflake");
    expect(document.tables).toHaveLength(2);

    const users = findTable(document, "users");
    const orders = findTable(document, "orders");
    const usersId = findField(users, "id");
    const usersEmail = findField(users, "email");
    const ordersId = findField(orders, "id");
    const ordersUserId = findField(orders, "user_id");

    expect(users.fields.map((field) => field.name)).toEqual(["id", "email"]);
    expect(orders.fields.map((field) => field.name)).toEqual(["id", "user_id"]);
    expect(usersId).toMatchObject({ type: "NUMBER", primary: true });
    expect(usersEmail).toMatchObject({
      type: "VARCHAR",
      primary: false,
      size: 255,
    });
    expect(ordersId).toMatchObject({ type: "NUMBER", primary: true });
    expect(ordersUserId).toMatchObject({ type: "NUMBER", primary: false });

    expect(document.references).toHaveLength(1);
    expect(document.references[0]).toMatchObject({
      name: "fk_orders_user_id_users",
      startTableId: orders.id,
      startFieldId: ordersUserId.id,
      endTableId: users.id,
      endFieldId: usersId.id,
      fields: [
        {
          startFieldId: ordersUserId.id,
          endFieldId: usersId.id,
        },
      ],
      updateConstraint: "No action",
      deleteConstraint: "No action",
      cardinality: "many_to_one",
    });
    expect(validateDoc(document).ok).toBe(true);
  });

  it("falls back to VARCHAR for unknown Snowflake types without throwing", () => {
    const { document, warnings } = buildDocumentFromMetadata({
      columns: [
        {
          table_name: "events",
          column_name: "payload",
          data_type: "MADE_UP_TYPE",
          is_nullable: "YES",
          ordinal_position: 1,
        },
      ],
      schema: "PUBLIC",
    });

    expect(findField(findTable(document, "events"), "payload").type).toBe(
      "VARCHAR",
    );
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown snowflake type/i)]),
    );
    expect(validateDoc(document).ok).toBe(true);
  });
});
