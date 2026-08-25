import { Parser } from "node-sql-parser";
import { describe, expect, it } from "vitest";
import { Cardinality, Constraint, DB } from "../../src/data/constants.js";
import { toSnowflake } from "../../src/utils/exportSQL/snowflake.js";
import { fromSnowflake } from "../../src/utils/importSQL/snowflake.js";

const diagram = {
  database: DB.SNOWFLAKE,
  tables: [
    {
      id: "users-table",
      name: "users",
      comment: "",
      fields: [
        {
          id: "users-id",
          name: "id",
          type: "NUMBER",
          primary: true,
          notNull: true,
          unique: false,
          increment: false,
          default: "",
          check: "",
          comment: "",
        },
        {
          id: "users-email",
          name: "email",
          type: "VARCHAR",
          size: 255,
          primary: false,
          notNull: true,
          unique: true,
          increment: false,
          default: "",
          check: "",
          comment: "",
        },
      ],
      indices: [],
      uniqueConstraints: [],
    },
    {
      id: "orders-table",
      name: "orders",
      comment: "",
      fields: [
        {
          id: "orders-id",
          name: "id",
          type: "NUMBER",
          primary: true,
          notNull: true,
          unique: false,
          increment: false,
          default: "",
          check: "",
          comment: "",
        },
        {
          id: "orders-user-id",
          name: "user_id",
          type: "NUMBER",
          primary: false,
          notNull: true,
          unique: false,
          increment: false,
          default: "",
          check: "",
          comment: "",
        },
      ],
      indices: [],
      uniqueConstraints: [],
    },
  ],
  references: [
    {
      id: "orders-users-fk",
      name: "fk_orders_user_id_users",
      startTableId: "orders-table",
      startFieldId: "orders-user-id",
      endTableId: "users-table",
      endFieldId: "users-id",
      fields: [{ startFieldId: "orders-user-id", endFieldId: "users-id" }],
      updateConstraint: Constraint.NONE,
      deleteConstraint: Constraint.CASCADE,
      cardinality: Cardinality.MANY_TO_ONE,
    },
  ],
};

describe("fromSnowflake", () => {
  it("round-trips tables, columns, and a foreign key", () => {
    const sql = toSnowflake(diagram);
    const parser = new Parser();
    const ast = parser.astify(sql, { database: DB.SNOWFLAKE });
    const imported = fromSnowflake(ast, DB.SNOWFLAKE);

    expect(imported.tables).toHaveLength(2);
    expect(imported.relationships).toHaveLength(1);

    const users = imported.tables.find((table) => table.name === "users");
    const orders = imported.tables.find((table) => table.name === "orders");
    expect(users?.fields.map((field) => field.name)).toEqual(["id", "email"]);
    expect(orders?.fields.map((field) => field.name)).toEqual([
      "id",
      "user_id",
    ]);
    expect(users?.fields.find((field) => field.name === "id")?.primary).toBe(
      true,
    );
    expect(users?.fields.find((field) => field.name === "email")?.type).toBe(
      "VARCHAR",
    );

    const reference = imported.relationships[0];
    const startField = orders?.fields.find(
      (field) => field.id === reference.startFieldId,
    );
    const endField = users?.fields.find(
      (field) => field.id === reference.endFieldId,
    );
    expect(startField?.name).toBe("user_id");
    expect(endField?.name).toBe("id");
    expect(reference.fields).toEqual([
      {
        startFieldId: reference.startFieldId,
        endFieldId: reference.endFieldId,
      },
    ]);
  });
});
