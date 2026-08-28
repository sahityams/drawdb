import { describe, expect, it } from "vitest";
import {
  DocumentSchema,
  emptyDoc,
  validateDoc,
} from "../src/doc/model.mjs";

function twoTableDoc() {
  return {
    ...emptyDoc("snowflake"),
    title: "Orders",
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
            unique: false,
            notNull: true,
            increment: false,
            default: "",
            check: "",
            comment: "",
            size: "",
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
            unique: false,
            notNull: true,
            increment: false,
            default: "",
            check: "",
            comment: "",
            size: "",
          },
          {
            id: "orders-user-id",
            name: "user_id",
            type: "NUMBER",
            primary: false,
            unique: false,
            notNull: true,
            increment: false,
            default: "",
            check: "",
            comment: "",
            size: "",
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
        updateConstraint: "No action",
        deleteConstraint: "Cascade",
        cardinality: "many_to_one",
      },
    ],
  };
}

describe("document model", () => {
  it("builds a valid empty Snowflake document", () => {
    const doc = emptyDoc("snowflake");

    expect(() => DocumentSchema.parse(doc)).not.toThrow();
    expect(validateDoc(doc)).toEqual({ ok: true, warnings: [] });
  });

  it("validates a populated document with a valid reference", () => {
    const doc = twoTableDoc();

    expect(() => DocumentSchema.parse(doc)).not.toThrow();
    expect(validateDoc(doc)).toEqual({ ok: true, warnings: [] });
  });

  it("warns about dangling references", () => {
    const doc = twoTableDoc();
    doc.tables = doc.tables.filter((table) => table.id !== "users-table");

    const result = validateDoc(doc);

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/dangling reference/i)]),
    );
  });

  it("warns about unknown field types for the dialect", () => {
    const doc = twoTableDoc();
    doc.tables[0].fields[0].type = "NOTATYPE";

    const result = validateDoc(doc);

    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown type/i)]),
    );
  });
});
