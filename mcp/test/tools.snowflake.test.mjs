import { beforeEach, describe, expect, it, vi } from "vitest";
import { snowflakeSchemaToDiagram } from "../src/tools/snowflake.mjs";

const mock = vi.hoisted(() => {
  const connection = {
    connect: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    connection,
    createConnection: vi.fn(),
    queryMetadata: vi.fn(),
  };
});

vi.mock(
  "snowflake-sdk",
  () => ({
    default: {
      createConnection: mock.createConnection,
    },
  }),
  { virtual: true },
);

vi.mock("../src/snowflake/client.mjs", () => ({
  queryMetadata: mock.queryMetadata,
}));

describe("Snowflake tool handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.createConnection.mockReturnValue(mock.connection);
    mock.connection.connect.mockImplementation((callback) =>
      callback(null, mock.connection),
    );
    mock.connection.destroy.mockImplementation((callback) => callback());
    mock.queryMetadata.mockResolvedValue({
      columns: [
        {
          table_name: "users",
          column_name: "id",
          data_type: "NUMBER",
          is_nullable: "NO",
          numeric_precision: 38,
          numeric_scale: 0,
          ordinal_position: 1,
        },
      ],
      primaryKeys: [{ table_name: "users", column_name: "id" }],
      foreignKeys: [],
    });
  });

  it("uses the mocked Snowflake driver and always closes the connection", async () => {
    const result = await snowflakeSchemaToDiagram({
      account: "test-account",
      username: "test-user",
      password: "test-password",
      warehouse: "test-warehouse",
      database: "test-database",
      schema: "PUBLIC",
      role: "test-role",
    });

    expect(mock.createConnection).toHaveBeenCalledWith({
      account: "test-account",
      username: "test-user",
      password: "test-password",
      authenticator: undefined,
      warehouse: "test-warehouse",
      database: "test-database",
      schema: "PUBLIC",
      role: "test-role",
    });
    expect(mock.queryMetadata).toHaveBeenCalledWith(mock.connection, "PUBLIC");
    expect(mock.connection.destroy).toHaveBeenCalledTimes(1);
    expect(result.document.tables).toHaveLength(1);
    expect(result.document.tables[0].fields[0]).toMatchObject({
      name: "id",
      type: "NUMBER",
      primary: true,
    });
  });

  it("closes the connection when metadata querying fails", async () => {
    mock.queryMetadata.mockRejectedValueOnce(new Error("metadata failed"));

    await expect(
      snowflakeSchemaToDiagram({
        account: "test-account",
        username: "test-user",
        database: "test-database",
        schema: "PUBLIC",
      }),
    ).rejects.toThrow("metadata failed");
    expect(mock.connection.destroy).toHaveBeenCalledTimes(1);
  });
});
