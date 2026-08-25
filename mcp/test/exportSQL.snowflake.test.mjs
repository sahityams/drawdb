import { describe, expect, it } from "vitest";
import { DB, Cardinality, Constraint } from "../../src/data/constants.js";
import { toSnowflake } from "../../src/utils/exportSQL/snowflake.js";

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

describe("toSnowflake", () => {
  it("exports tables, primary keys, varchar columns, and foreign keys", () => {
    const sql = toSnowflake(diagram);

    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('"id" NUMBER');
    expect(sql).toContain('PRIMARY KEY("id")');
    expect(sql).toContain('"email" VARCHAR(255)');
    expect(sql).toContain(
      'FOREIGN KEY("user_id") REFERENCES "users"("id")',
    );
  });
});
