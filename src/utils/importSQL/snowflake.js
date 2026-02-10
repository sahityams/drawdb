import { nanoid } from "nanoid";
import { Cardinality, Constraint, DB } from "../../data/constants";
import { dbToTypes } from "../../data/datatypes";
import { buildSQLFromAST } from "./shared";

const affinity = {
  [DB.SNOWFLAKE]: new Proxy(
    {},
    { get: (target, prop) => (prop in target ? target[prop] : "VARCHAR") },
  ),
  [DB.GENERIC]: new Proxy(
    {
      INTEGER: "INT",
      "CHARACTER VARYING": "VARCHAR",
      "DOUBLE PRECISION": "DOUBLE",
    },
    { get: (target, prop) => (prop in target ? target[prop] : "VARCHAR") },
  ),
};

export function fromSnowflake(ast, diagramDb = DB.GENERIC) {
  const tables = [];
  const relationships = [];

  const parseSingleStatement = (e) => {
    if (e.type === "create") {
      if (e.keyword === "table") {
        const table = {};
        table.name = e.table[0].table;
        table.comment = "";
        table.color = "#175e7a";
        table.fields = [];
        table.indices = [];
        table.id = nanoid();
        e.create_definitions.forEach((d) => {
          const field = {};
          if (d.resource === "column") {
            field.id = nanoid();
            field.name = d.column.column.expr.value;

            let type =
              dbToTypes[diagramDb][d.definition.dataType.toUpperCase()]?.type;
            type ??= affinity[diagramDb][d.definition.dataType.toUpperCase()];

            field.type = type;

            field.comment = d.comment ? d.comment.value.value : "";
            field.unique = false;
            if (d.unique) field.unique = true;
            field.increment = false;
            if (d.auto_increment) field.increment = true;
            field.notNull = false;
            if (d.nullable) field.notNull = true;
            field.primary = false;
            if (d.primary_key) field.primary = true;
            field.default = "";
            if (d.default_val) {
              let defaultValue = "";
              if (d.default_val.value.type === "function") {
                defaultValue = d.default_val.value.name.name[0].value;
                if (d.default_val.value.args) {
                  defaultValue +=
                    "(" +
                    d.default_val.value.args.value
                      .map((v) => {
                        if (
                          v.type === "single_quote_string" ||
                          v.type === "double_quote_string"
                        )
                          return "'" + v.value + "'";
                        return v.value;
                      })
                      .join(", ") +
                    ")";
                }
              } else if (d.default_val.value.type === "null") {
                defaultValue = "NULL";
              } else if (d.default_val.value.type === "cast") {
                defaultValue = d.default_val.value.expr.value;
              } else {
                defaultValue = d.default_val.value.value.toString();
              }
              field.default = defaultValue;
            }
            if (d.definition["length"]) {
              if (d.definition.scale) {
                field.size = d.definition["length"] + "," + d.definition.scale;
              } else {
                field.size = d.definition["length"];
              }
            }
            field.check = "";
            if (d.check) {
              field.check = buildSQLFromAST(
                d.check.definition[0],
                DB.SNOWFLAKE,
              );
            }

            table.fields.push(field);
          } else if (d.resource === "constraint") {
            if (d.constraint_type === "primary key") {
              d.definition.forEach((c) => {
                table.fields.forEach((f) => {
                  if (f.name === c.column.expr.value && !f.primary) {
                    f.primary = true;
                  }
                });
              });
            } else if (d.constraint_type.toLowerCase() === "foreign key") {
              const relationship = {};
              const startTableId = table.id;
              const startTableName = e.table[0].table;
              const startFieldName = d.definition[0].column.expr.value;
              const endTableName = d.reference_definition.table[0].table;
              const endFieldName =
                d.reference_definition.definition[0].column.expr.value;

              const endTable = tables.find((t) => t.name === endTableName);
              if (!endTable) return;

              const endField = endTable.fields.find(
                (f) => f.name === endFieldName,
              );
              if (!endField) return;

              const startField = table.fields.find(
                (f) => f.name === startFieldName,
              );
              if (!startField) return;

              relationship.name = `fk_${startTableName}_${startFieldName}_${endTableName}`;
              relationship.startTableId = startTableId;
              relationship.endTableId = endTable.id;
              relationship.endFieldId = endField.id;
              relationship.startFieldId = startField.id;
              relationship.id = nanoid();

              let updateConstraint = Constraint.NONE;
              let deleteConstraint = Constraint.NONE;
              if (d.reference_definition.on_action) {
                d.reference_definition.on_action.forEach((c) => {
                  if (c.type === "on update") {
                    updateConstraint = c.value.value;
                    updateConstraint =
                      updateConstraint[0].toUpperCase() +
                      updateConstraint.substring(1);
                  } else if (c.type === "on delete") {
                    deleteConstraint = c.value.value;
                    deleteConstraint =
                      deleteConstraint[0].toUpperCase() +
                      deleteConstraint.substring(1);
                  }
                });
              }

              relationship.updateConstraint = updateConstraint;
              relationship.deleteConstraint = deleteConstraint;
              if (startField.unique) {
                relationship.cardinality = Cardinality.ONE_TO_ONE;
              } else {
                relationship.cardinality = Cardinality.MANY_TO_ONE;
              }
              relationships.push(relationship);
            }
          }

          if (d.reference_definition) {
            const relationship = {};
            const startTableName = table.name;
            const startFieldName = field.name;
            const endTableName = d.reference_definition.table[0].table;
            const endFieldName =
              d.reference_definition.definition[0].column.expr.value;
            let updateConstraint = Constraint.NONE;
            let deleteConstraint = Constraint.NONE;
            if (d.reference_definition.on_action) {
              d.reference_definition.on_action.forEach((c) => {
                if (c.type === "on update") {
                  updateConstraint = c.value.value;
                  updateConstraint =
                    updateConstraint[0].toUpperCase() +
                    updateConstraint.substring(1);
                } else if (c.type === "on delete") {
                  deleteConstraint = c.value.value;
                  deleteConstraint =
                    deleteConstraint[0].toUpperCase() +
                    deleteConstraint.substring(1);
                }
              });
            }

            const startTableId = tables.length;

            const endTable = tables.find((t) => t.name === endTableName);
            if (!endTable) return;

            const endField = endTable.fields.findIndex(
              (f) => f.name === endFieldName,
            );
            if (!endField) return;

            const startField = table.fields.find(
              (f) => f.name === startFieldName,
            );
            if (!startField) return;

            relationship.name = `fk_${startTableName}_${startFieldName}_${endTableName}`;
            relationship.startTableId = startTableId;
            relationship.startFieldId = startField.id;
            relationship.endTableId = endTable.id;
            relationship.endFieldId = endField.id;
            relationship.updateConstraint = updateConstraint;
            relationship.deleteConstraint = deleteConstraint;
            relationship.id = nanoid();

            if (startField.unique) {
              relationship.cardinality = Cardinality.ONE_TO_ONE;
            } else {
              relationship.cardinality = Cardinality.MANY_TO_ONE;
            }

            relationships.push(relationship);
          }
        });
        tables.push(table);
      } else if (e.keyword === "index") {
        const index = {
          name: e.index,
          unique: e.index_type === "unique",
          fields: e.index_columns.map((f) => f.column.expr.value),
        };

        const table = tables.find((t) => t.name === e.table.table);

        if (table) {
          table.indices.push(index);
          table.indices.forEach((i, j) => {
            i.id = j;
          });
        }
      }
    } else if (e.type === "alter") {
      if (Array.isArray(e.expr)) {
        e.expr.forEach((expr) => {
          if (
            expr.action === "add" &&
            expr.create_definitions.constraint_type.toLowerCase() ===
              "foreign key"
          ) {
            const relationship = {};
            const startTableName = e.table[0].table;
            const startFieldName =
              expr.create_definitions.definition[0].column.expr.value;
            const endTableName =
              expr.create_definitions.reference_definition.table[0].table;
            const endFieldName =
              expr.create_definitions.reference_definition.definition[0].column
                .expr.value;
            let updateConstraint = Constraint.NONE;
            let deleteConstraint = Constraint.NONE;
            if (expr.create_definitions.reference_definition.on_action) {
              expr.create_definitions.reference_definition.on_action.forEach(
                (c) => {
                  if (c.type === "on update") {
                    updateConstraint = c.value.value;
                    updateConstraint =
                      updateConstraint[0].toUpperCase() +
                      updateConstraint.substring(1);
                  } else if (c.type === "on delete") {
                    deleteConstraint = c.value.value;
                    deleteConstraint =
                      deleteConstraint[0].toUpperCase() +
                      deleteConstraint.substring(1);
                  }
                },
              );
            }

            const startTable = tables.find((t) => t.name === startTableName);
            if (!startTable) return;

            const endTable = tables.find((t) => t.name === endTableName);
            if (!endTable) return;

            const endField = endTable.fields.find(
              (f) => f.name === endFieldName,
            );
            if (!endField) return;

            const startField = startTable.fields.find(
              (f) => f.name === startFieldName,
            );
            if (!startField) return;

            relationship.name = `fk_${startTableName}_${startFieldName}_${endTableName}`;
            relationship.startTableId = startTable.id;
            relationship.startFieldId = startField.id;
            relationship.endTableId = endTable.id;
            relationship.endFieldId = endField.id;
            relationship.updateConstraint = updateConstraint;
            relationship.deleteConstraint = deleteConstraint;
            relationship.cardinality = Cardinality.ONE_TO_ONE;
            relationship.id = nanoid();

            if (startField.unique) {
              relationship.cardinality = Cardinality.ONE_TO_ONE;
            } else {
              relationship.cardinality = Cardinality.MANY_TO_ONE;
            }

            relationships.push(relationship);
          }
        });
      }
    } else if (e.type === "comment") {
      if (e.target.type === "table") {
        const table = tables.find((t) => t.name === e.target?.name?.table);
        if (table) {
          table.comment = e.expr.expr.value;
        }
      } else if (e.target.type === "column") {
        const table = tables.find((t) => t.name === e.target?.name?.table);
        if (table) {
          const field = table.fields.find(
            (f) => f.name === e.target?.name?.column?.expr?.value,
          );
          if (field) {
            field.comment = e.expr.expr.value;
          }
        }
      }
    }
  };

  if (Array.isArray(ast)) {
    ast.forEach((e) => parseSingleStatement(e));
  } else {
    parseSingleStatement(ast);
  }

  return { tables, relationships };
}
