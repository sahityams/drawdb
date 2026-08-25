import "snowflake-sdk";

function execute(connection, sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete(error, _statement, rows) {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows ?? []);
      },
    });
  });
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([key, rowValue]) => [
      key.toLowerCase(),
      rowValue,
    ]),
  );
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

/**
 * Query Snowflake metadata for one schema.
 *
 * This uses INFORMATION_SCHEMA.COLUMNS plus INFORMATION_SCHEMA table
 * constraints/key usage/referential constraints for PK and imported FK metadata.
 */
export async function queryMetadata(connection, schema) {
  const columns = await execute(
    connection,
    `SELECT table_name, column_name, data_type, is_nullable,
            character_maximum_length, numeric_precision, numeric_scale,
            ordinal_position, column_default, comment
       FROM information_schema.columns
      WHERE table_schema = ?
      ORDER BY table_name, ordinal_position`,
    [schema],
  );

  const primaryKeys = await execute(
    connection,
    `SELECT kcu.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_catalog = kcu.constraint_catalog
        AND tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = ?
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.table_name, kcu.ordinal_position`,
    [schema],
  );

  const foreignKeys = await execute(
    connection,
    `SELECT fk_kcu.table_name AS fk_table,
            fk_kcu.column_name AS fk_column,
            pk_kcu.table_name AS pk_table,
            pk_kcu.column_name AS pk_column,
            fk_kcu.constraint_name,
            fk_kcu.ordinal_position AS key_sequence,
            rc.update_rule,
            rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.key_column_usage fk_kcu
         ON rc.constraint_catalog = fk_kcu.constraint_catalog
        AND rc.constraint_schema = fk_kcu.constraint_schema
        AND rc.constraint_name = fk_kcu.constraint_name
       JOIN information_schema.key_column_usage pk_kcu
         ON rc.unique_constraint_catalog = pk_kcu.constraint_catalog
        AND rc.unique_constraint_schema = pk_kcu.constraint_schema
        AND rc.unique_constraint_name = pk_kcu.constraint_name
        AND fk_kcu.ordinal_position = pk_kcu.ordinal_position
      WHERE fk_kcu.table_schema = ?
      ORDER BY fk_kcu.table_name, fk_kcu.constraint_name, fk_kcu.ordinal_position`,
    [schema],
  );

  return {
    columns: normalizeRows(columns),
    primaryKeys: normalizeRows(primaryKeys),
    foreignKeys: normalizeRows(foreignKeys),
  };
}
