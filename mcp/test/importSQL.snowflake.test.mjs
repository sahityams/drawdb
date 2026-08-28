import pkg from "node-sql-parser";
import { describe, expect, it } from "vitest";
import { DB } from "../../src/data/constants.js";
import { fromSnowflake } from "../../src/utils/importSQL/snowflake.js";

const { Parser } = pkg;

function parse(sql) {
  return new Parser().astify(sql, { database: DB.SNOWFLAKE });
}

describe("fromSnowflake", () => {
  it("imports tables, typed/sized columns, PK, NOT NULL, UNIQUE, DEFAULT, comments", () => {
    const sql = `
      CREATE TABLE "users" (
        "id" NUMBER NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE COMMENT 'login email',
        "balance" NUMBER(10,2) DEFAULT 0,
        "status" VARCHAR(20) DEFAULT 'active',
        PRIMARY KEY("id")
      ) COMMENT = 'app users';
    `;
    const { tables } = fromSnowflake(parse(sql), DB.SNOWFLAKE);
    expect(tables).toHaveLength(1);
    const users = tables[0];
    expect(users.name).toBe("users");
    expect(users.comment).toBe("app users");

    const byName = Object.fromEntries(users.fields.map((f) => [f.name, f]));
    expect(users.fields.map((f) => f.name)).toEqual([
      "id",
      "email",
      "balance",
      "status",
    ]);
    expect(byName.id.primary).toBe(true);
    expect(byName.id.notNull).toBe(true);
    expect(byName.email.type).toBe("VARCHAR");
    expect(byName.email.size).toBe("255");
    expect(byName.email.unique).toBe(true);
    expect(byName.email.comment).toBe("login email");
    expect(byName.balance.size).toBe("10,2");
    expect(byName.status.default).toBe("active");
  });

  it("imports a table-level UNIQUE constraint", () => {
    const sql = `
      CREATE TABLE "t" (
        "a" NUMBER,
        "b" NUMBER,
        CONSTRAINT "uq_ab" UNIQUE ("a", "b")
      );
    `;
    const { tables } = fromSnowflake(parse(sql), DB.SNOWFLAKE);
    expect(tables[0].uniqueConstraints).toHaveLength(1);
    expect(tables[0].uniqueConstraints[0].fields).toEqual(["a", "b"]);
  });

  it("imports foreign keys from ALTER TABLE with referential actions", () => {
    const sql = `
      CREATE TABLE "users" ("id" NUMBER NOT NULL, PRIMARY KEY("id"));
      CREATE TABLE "orders" ("id" NUMBER NOT NULL, "user_id" NUMBER NOT NULL, PRIMARY KEY("id"));
      ALTER TABLE "orders"
      ADD FOREIGN KEY("user_id") REFERENCES "users"("id")
      ON UPDATE NO ACTION ON DELETE CASCADE;
    `;
    const { tables, relationships } = fromSnowflake(parse(sql), DB.SNOWFLAKE);
    expect(relationships).toHaveLength(1);
    const rel = relationships[0];
    const orders = tables.find((t) => t.name === "orders");
    const users = tables.find((t) => t.name === "users");
    expect(rel.startTableId).toBe(orders.id);
    expect(rel.endTableId).toBe(users.id);
    expect(orders.fields.find((f) => f.id === rel.startFieldId).name).toBe(
      "user_id",
    );
    expect(users.fields.find((f) => f.id === rel.endFieldId).name).toBe("id");
    expect(rel.deleteConstraint).toBe("Cascade");
  });

  it("imports a function default with its arguments", () => {
    const sql = `CREATE TABLE "t" ("ts" TIMESTAMP_NTZ DEFAULT CONVERT_TIMEZONE('UTC', "x"));`;
    const { tables } = fromSnowflake(parse(sql), DB.SNOWFLAKE);
    const def = tables[0].fields[0].default;
    expect(def).toContain("CONVERT_TIMEZONE");
    expect(def).toContain("'UTC'");
  });

  it("imports a column-level inline foreign key", () => {
    const sql = `
      CREATE TABLE "users" ("id" NUMBER NOT NULL, PRIMARY KEY("id"));
      CREATE TABLE "orders" (
        "id" NUMBER NOT NULL,
        "user_id" NUMBER REFERENCES "users"("id"),
        PRIMARY KEY("id")
      );
    `;
    const { relationships } = fromSnowflake(parse(sql), DB.SNOWFLAKE);
    expect(relationships).toHaveLength(1);
  });
});
