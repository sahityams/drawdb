export const databases = new Proxy(
  {
    mysql: {
      name: "MySQL",
      hasTypes: false,
    },
    postgresql: {
      name: "PostgreSQL",
      hasTypes: true,
    },
    sqlite: {
      name: "SQLite",
      hasTypes: false,
    },
    mariadb: {
      name: "MariaDB",
      hasTypes: false,
    },
    transactsql: {
      name: "MSSQL",
      hasTypes: false,
    },
    oraclesql: {
      name: "Oracle SQL",
      hasTypes: false,
    },
    snowflake: {
      name: "Snowflake",
      hasTypes: true,
    },
    generic: {
      name: "generic",
      hasTypes: true,
    },
  },
  { get: (target, prop) => (prop in target ? target[prop] : {}) },
);
