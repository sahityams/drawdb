import { describe, expect, it } from "vitest";
import {
  exportSQL,
  jsonToDocumentation,
  jsonToMermaid,
} from "../src/generated/drawdb-core.mjs";

const sampleDoc = {
  database: "snowflake",
  title: "Sales",
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
  relationships: [
    {
      id: "orders-users-fk",
      name: "fk_orders_user_id_users",
      startTableId: "orders-table",
      startFieldId: "orders-user-id",
      endTableId: "users-table",
      endFieldId: "users-id",
      fields: [{ startFieldId: "orders-user-id", endFieldId: "users-id" }],
      cardinality: "many_to_one",
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
      updateConstraint: "No action",
      deleteConstraint: "Cascade",
      cardinality: "many_to_one",
    },
  ],
  types: [],
};

describe("drawdb core bundle", () => {
  it("exports Snowflake SQL from the bundled core", () => {
    const sql = exportSQL({
      database: "snowflake",
      tables: [
        {
          id: "t",
          name: "users",
          comment: "",
          fields: [
            {
              id: "f",
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
          ],
          indices: [],
          uniqueConstraints: [],
        },
      ],
      references: [],
    });

    expect(sql).toContain('CREATE TABLE "users"');
  });

  it("exports Mermaid with relationship cardinality from the bundled core", () => {
    const mermaid = jsonToMermaid(sampleDoc);

    expect(mermaid).not.toHaveLength(0);
    expect(mermaid).toContain("}o--||");
  });

  it("exports documentation from the bundled core", () => {
    const documentation = jsonToDocumentation(sampleDoc);

    expect(documentation).not.toHaveLength(0);
    // Header comes from the stubbed databases[db].name, then the fixed section title.
    expect(documentation).toContain("Snowflake");
    expect(documentation).toContain("## Table structure");
  });
});
