import { describe, expect, it } from "vitest";
import { DB, Cardinality, Constraint } from "../../src/data/constants.js";
import { toSnowflake } from "../../src/utils/exportSQL/snowflake.js";

function field(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type,
    primary: false,
    unique: false,
    notNull: false,
    increment: false,
    default: "",
    check: "",
    comment: "",
    size: "",
    ...overrides,
  };
}

const diagram = {
  database: DB.SNOWFLAKE,
  tables: [
    {
      id: "users-table",
      name: "users",
      comment: "app users",
      fields: [
        field({
          id: "users-id",
          name: "id",
          type: "NUMBER",
          primary: true,
          notNull: true,
          increment: true,
        }),
        field({
          id: "users-email",
          name: "email",
          type: "VARCHAR",
          size: 255,
          notNull: true,
          unique: true,
          comment: "login email",
        }),
        field({
          id: "users-balance",
          name: "balance",
          type: "NUMBER",
          size: "10,2",
          default: "0",
        }),
        field({ id: "users-status", name: "status", type: "VARCHAR", size: 20, default: "active" }),
      ],
      indices: [{ id: 0, name: "idx_email", unique: true, fields: ["email"] }],
      uniqueConstraints: [
        { id: 0, name: "uq_users_email_status", fields: ["email", "status"] },
      ],
    },
    {
      id: "orders-table",
      name: "orders",
      comment: "",
      fields: [
        field({ id: "orders-id", name: "id", type: "NUMBER", primary: true, notNull: true }),
        field({ id: "orders-user-id", name: "user_id", type: "NUMBER", notNull: true }),
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
  const sql = toSnowflake(diagram);

  it("emits CREATE TABLE with primary key and typed columns", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(sql).toContain('"id" NUMBER');
    expect(sql).toContain('PRIMARY KEY("id")');
    expect(sql).toContain('"email" VARCHAR(255)');
    expect(sql).toContain('"balance" NUMBER(10,2)');
  });

  it("emits NOT NULL, UNIQUE, AUTOINCREMENT and DEFAULT", () => {
    expect(sql).toContain("NOT NULL");
    expect(sql).toContain('"email" VARCHAR(255) NOT NULL UNIQUE');
    expect(sql).toContain('"id" NUMBER NOT NULL AUTOINCREMENT');
    expect(sql).toContain("DEFAULT 'active'");
    // NUMBER has no hasQuotes flag, so a numeric default is emitted unquoted.
    expect(sql).toContain("DEFAULT 0");
  });

  it("emits inline column and table comments", () => {
    expect(sql).toContain("COMMENT 'login email'");
    expect(sql).toContain("COMMENT = 'app users'");
  });

  it("emits table-level UNIQUE constraint", () => {
    expect(sql).toContain('CONSTRAINT "uq_users_email_status" UNIQUE ("email", "status")');
  });

  it("emits foreign keys via ALTER TABLE", () => {
    expect(sql).toContain('ALTER TABLE "orders"');
    expect(sql).toContain('FOREIGN KEY("user_id") REFERENCES "users"("id")');
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("does NOT emit CHECK or CREATE INDEX (unsupported by Snowflake)", () => {
    expect(sql).not.toContain("CHECK");
    expect(sql).not.toContain("CREATE INDEX");
    expect(sql).not.toContain("CREATE UNIQUE INDEX");
  });
});
