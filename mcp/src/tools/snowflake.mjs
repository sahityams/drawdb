import { z } from "zod";
import { buildDocumentFromMetadata } from "../snowflake/introspect.mjs";

function toolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

function connect(connection) {
  return new Promise((resolve, reject) => {
    connection.connect((error, connectedConnection) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(connectedConnection ?? connection);
    });
  });
}

async function destroy(connection) {
  if (!connection?.destroy) {
    return;
  }

  await new Promise((resolve) => {
    connection.destroy(() => resolve());
  });
}

export async function snowflakeSchemaToDiagram({
  account,
  username,
  password,
  authenticator,
  warehouse,
  database,
  schema,
  role,
}) {
  const [snowflakeModule, { queryMetadata }] = await Promise.all([
    import("snowflake-sdk"),
    import("../snowflake/client.mjs"),
  ]);
  const snowflake = snowflakeModule.default ?? snowflakeModule;
  const connection = snowflake.createConnection({
    account,
    username,
    password,
    authenticator,
    warehouse,
    database,
    schema,
    role,
  });

  try {
    const connectedConnection = await connect(connection);
    const metadata = await queryMetadata(connectedConnection, schema);
    return buildDocumentFromMetadata({ ...metadata, schema });
  } finally {
    await destroy(connection);
  }
}

export function registerSnowflakeTools(server) {
  server.registerTool(
    "snowflake_schema_to_diagram",
    {
      description:
        "Connect to Snowflake, introspect one schema, and return a canonical DrawDB document.",
      inputSchema: z.object({
        account: z.string(),
        username: z.string(),
        password: z.string().optional(),
        authenticator: z.string().optional(),
        warehouse: z.string().optional(),
        database: z.string(),
        schema: z.string(),
        role: z.string().optional(),
      }),
    },
    async (args) => toolResult(await snowflakeSchemaToDiagram(args)),
  );
}
