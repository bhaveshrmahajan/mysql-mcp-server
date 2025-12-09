#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";
import { z } from "zod";

const server = new Server(
  {
    name: "mysql-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node build/index.js <database-url>");
  console.error("Example: mysql://user:password@localhost:3306/database");
  process.exit(1);
}

const databaseUrl = args[0];
let pool: mysql.Pool;

try {
  pool = mysql.createPool(databaseUrl);
} catch (error) {
  console.error("Failed to create connection pool", error);
  process.exit(1);
}

const isSelectOrShowOrDescribe = (query: string) => {
  const q = query.trim().toLowerCase();
  return q.startsWith("select") || q.startsWith("show") || q.startsWith("describe");
};

// Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list-tables",
        description: "List all tables in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "describe-table",
        description: "Get the schema of a specific table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "The name of the table to describe",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "create-table",
        description: "Create a new table in the database",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The CREATE TABLE SQL query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "insert-row",
        description: "Insert a new row into a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "The name of the table to insert into",
            },
            data: {
              type: "object",
              description: "The data to insert as a JSON object (key-value pairs matching column names)",
            },
          },
          required: ["tableName", "data"],
        },
      },
      {
        name: "update-row",
        description: "Update existing rows in a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "The name of the table to update",
            },
            data: {
              type: "object",
              description: "The data to update as a JSON object (key-value pairs)",
            },
            where: {
              type: "object",
              description: "The WHERE clause conditions as a JSON object (key-value pairs)",
            },
          },
          required: ["tableName", "data", "where"],
        },
      },
      {
        name: "delete-row",
        description: "Delete rows from a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "The name of the table to delete from",
            },
            where: {
              type: "object",
              description: "The WHERE clause conditions as a JSON object (key-value pairs)",
            },
          },
          required: ["tableName", "where"],
        },
      },
      {
        name: "execute-query",
        description: "Execute a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The SQL query to execute",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "execute-write-query",
        description: "Execute a write (INSERT, UPDATE, DELETE, etc.) SQL query",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The SQL query to execute",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "create-database",
        description: "Create a new database",
        inputSchema: {
          type: "object",
          properties: {
            databaseName: {
              type: "string",
              description: "The name of the new database to create",
            },
          },
          required: ["databaseName"],
        },
      },
      {
        name: "list-procedures",
        description: "List all stored procedures in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "show-procedure",
        description: "Show the CREATE statement for a specific stored procedure",
        inputSchema: {
          type: "object",
          properties: {
            procedureName: {
              type: "string",
              description: "The name of the procedure to show",
            },
          },
          required: ["procedureName"],
        },
      },
      {
        name: "list-functions",
        description: "List all stored functions in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "show-function",
        description: "Show the CREATE statement for a specific stored function",
        inputSchema: {
          type: "object",
          properties: {
            functionName: {
              type: "string",
              description: "The name of the function to show",
            },
          },
          required: ["functionName"],
        },
      },
      {
        name: "list-triggers",
        description: "List all triggers in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "show-trigger",
        description: "Show the CREATE statement for a specific trigger",
        inputSchema: {
          type: "object",
          properties: {
            triggerName: {
              type: "string",
              description: "The name of the trigger to show",
            },
          },
          required: ["triggerName"],
        },
      },
      {
        name: "list-views",
        description: "List all views in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "show-view",
        description: "Show the CREATE statement for a specific view",
        inputSchema: {
          type: "object",
          properties: {
            viewName: {
              type: "string",
              description: "The name of the view to show",
            },
          },
          required: ["viewName"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "list-tables") {
    try {
      const [rows] = await pool.query("SHOW TABLES");
      const tables = (rows as any[]).map((row) => Object.values(row)[0]);
      return {
        content: [
          {
            type: "text",
            text: `Tables in database:\n${tables.join("\n")}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error listing tables: ${error.message}`);
    }
  }

  if (request.params.name === "describe-table") {
    const tableName = String(request.params.arguments?.tableName);
    try {
      const [rows] = await pool.query(`DESCRIBE ??`, [tableName]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error describing table ${tableName}: ${error.message}`);
    }
  }

  if (request.params.name === "create-table") {
    const query = String(request.params.arguments?.query);
    try {
      await pool.query(query);
      return {
        content: [
          {
            type: "text",
            text: `Table created successfully`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error creating table: ${error.message}`);
    }
  }

  if (request.params.name === "insert-row") {
    const tableName = String(request.params.arguments?.tableName);
    const data = request.params.arguments?.data as object;
    try {
      await pool.query(`INSERT INTO ?? SET ?`, [tableName, data]);
      return {
        content: [
          {
            type: "text",
            text: `Row inserted successfully into ${tableName}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error inserting row: ${error.message}`);
    }
  }

  if (request.params.name === "update-row") {
    const tableName = String(request.params.arguments?.tableName);
    const data = request.params.arguments?.data as object;
    const where = request.params.arguments?.where as object;

    // Construct simplified WHERE clause for equality checks
    // This is a basic implementation. For more complex where clauses, users should use execute-write-query
    const whereClause = Object.keys(where)
      .map(key => `\`${key}\` = ?`)
      .join(" AND ");
    const whereValues = Object.values(where);

    if (!whereClause) {
      throw new McpError(ErrorCode.InvalidParams, "WHERE clause is required for update-row");
    }

    try {
      // SET ? uses standard mysql2 escaping for object keys/values
      const [result] = await pool.query(
        `UPDATE ?? SET ? WHERE ${whereClause}`,
        [tableName, data, ...whereValues]
      );
      return {
        content: [
          {
            type: "text",
            text: `Rows updated: ${(result as any).affectedRows}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error updating row: ${error.message}`);
    }
  }

  if (request.params.name === "delete-row") {
    const tableName = String(request.params.arguments?.tableName);
    const where = request.params.arguments?.where as object;

    const whereClause = Object.keys(where)
      .map(key => `\`${key}\` = ?`)
      .join(" AND ");
    const whereValues = Object.values(where);

    if (!whereClause) {
      throw new McpError(ErrorCode.InvalidParams, "WHERE clause is required for delete-row");
    }

    try {
      const [result] = await pool.query(
        `DELETE FROM ?? WHERE ${whereClause}`,
        [tableName, ...whereValues]
      );
      return {
        content: [
          {
            type: "text",
            text: `Rows deleted: ${(result as any).affectedRows}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Error deleting row: ${error.message}`);
    }
  }

  if (request.params.name === "execute-query") {
    const query = String(request.params.arguments?.query);
    if (!isSelectOrShowOrDescribe(query)) {
      throw new McpError(ErrorCode.InvalidParams, "Only SELECT, SHOW, and DESCRIBE queries are allowed for this tool. Use execute-write-query for modifications.");
    }
    try {
      const [rows] = await pool.query(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error executing query: ${errorMessage}`);
    }
  }

  if (request.params.name === "execute-write-query") {
    const query = String(request.params.arguments?.query);
    try {
      const [result] = await pool.query(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error executing write query: ${errorMessage}`);
    }
  }

  if (request.params.name === "create-database") {
    const databaseName = String(request.params.arguments?.databaseName);
    try {
      // Escape database name manually or use ?? for identifier
      await pool.query(`CREATE DATABASE ??`, [databaseName]);
      return {
        content: [
          {
            type: "text",
            text: `Database '${databaseName}' created successfully`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error creating database: ${errorMessage}`);
    }
  }

  // Procedure Tools
  if (request.params.name === "list-procedures") {
    try {
      const [rows] = await pool.query("SHOW PROCEDURE STATUS WHERE Db = DATABASE()");
      const procedures = (rows as any[]).map((row) => row.Name);
      return {
        content: [
          {
            type: "text",
            text: `Stored Procedures:\n${procedures.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error listing procedures: ${errorMessage}`);
    }
  }

  if (request.params.name === "show-procedure") {
    const procedureName = String(request.params.arguments?.procedureName);
    try {
      const [rows] = await pool.query(`SHOW CREATE PROCEDURE ??`, [procedureName]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error showing procedure ${procedureName}: ${errorMessage}`);
    }
  }

  // Function Tools
  if (request.params.name === "list-functions") {
    try {
      const [rows] = await pool.query("SHOW FUNCTION STATUS WHERE Db = DATABASE()");
      const functions = (rows as any[]).map((row) => row.Name);
      return {
        content: [
          {
            type: "text",
            text: `Stored Functions:\n${functions.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error listing functions: ${errorMessage}`);
    }
  }

  if (request.params.name === "show-function") {
    const functionName = String(request.params.arguments?.functionName);
    try {
      const [rows] = await pool.query(`SHOW CREATE FUNCTION ??`, [functionName]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error showing function ${functionName}: ${errorMessage}`);
    }
  }

  // Trigger Tools
  if (request.params.name === "list-triggers") {
    try {
      const [rows] = await pool.query("SHOW TRIGGERS");
      const triggers = (rows as any[]).map((row) => row.Trigger);
      return {
        content: [
          {
            type: "text",
            text: `Triggers:\n${triggers.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error listing triggers: ${errorMessage}`);
    }
  }

  if (request.params.name === "show-trigger") {
    const triggerName = String(request.params.arguments?.triggerName);
    try {
      const [rows] = await pool.query(`SHOW CREATE TRIGGER ??`, [triggerName]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error showing trigger ${triggerName}: ${errorMessage}`);
    }
  }

  // View Tools
  if (request.params.name === "list-views") {
    try {
      const [rows] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
      const views = (rows as any[]).map((row) => Object.values(row)[0]);
      return {
        content: [
          {
            type: "text",
            text: `Views:\n${views.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error listing views: ${errorMessage}`);
    }
  }

  if (request.params.name === "show-view") {
    const viewName = String(request.params.arguments?.viewName);
    try {
      const [rows] = await pool.query(`SHOW CREATE VIEW ??`, [viewName]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error showing view ${viewName}: ${errorMessage}`);
    }
  }

  throw new McpError(ErrorCode.MethodNotFound, "Tool not found");
});

// Prompts Handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze-table",
        description: "Analyze a table's structure and sample data",
        arguments: [
          {
            name: "tableName",
            description: "The name of the table to analyze",
            required: true,
          },
        ],
      },
      {
        name: "optimize-query",
        description: "Analyze and optimize a SQL query",
        arguments: [
          {
            name: "query",
            description: "The SQL query to optimize",
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "analyze-table") {
    const tableName = request.params.arguments?.tableName;
    if (!tableName) {
      throw new McpError(ErrorCode.InvalidParams, "tableName argument is required");
    }

    try {
      const [schemaRows] = await pool.query(`DESCRIBE ??`, [tableName]);
      const [dataRows] = await pool.query(`SELECT * FROM ?? LIMIT 5`, [tableName]);

      const schemaStr = JSON.stringify(schemaRows, null, 2);
      const dataStr = JSON.stringify(dataRows, null, 2);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the structure and sample data for the table '${tableName}'.

Schema:
${schemaStr}

Sample Data (first 5 rows):
${dataStr}

Provide insights on the schema design, potential relationships, and data distribution.
`,
            },
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error fetching table details: ${errorMessage}`);
    }
  }

  if (request.params.name === "optimize-query") {
    const query = request.params.arguments?.query;
    if (!query) {
      throw new McpError(ErrorCode.InvalidParams, "query argument is required");
    }

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the following SQL query for performance optimization opportunities. explain the query plan if possible involved tables.

Query:
${query}

Suggest improvements such as indexing, query rewriting of joins, or structural changes.
`,
          },
        },
      ],
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, "Prompt not found");
});

// Resources Handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const [rows] = await pool.query("SHOW TABLES");
    const tables = (rows as any[]).map((row) => Object.values(row)[0] as string);

    return {
      resources: tables.flatMap((table) => [
        {
          uri: `mysql://${table}/schema`,
          name: `${table} Schema`,
          mimeType: "application/json",
          description: `Schema for table ${table}`,
        },
        {
          uri: `mysql://${table}/data`,
          name: `${table} Data`,
          mimeType: "application/json",
          description: `First 100 rows of table ${table}`,
        }
      ]),
    };
  } catch (error: any) {
    console.error("Error listing resources", error);
    return { resources: [] };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const pathParts = url.pathname.split("/").filter(Boolean); // host is tableName in mysql://tableName/schema, or path?

  // URI format: mysql://<table>/schema or mysql://<table>/data
  // URL object parsing:
  // href: mysql://mytable/schema
  // hostname: mytable
  // pathname: /schema

  const tableName = url.hostname;
  const type = url.pathname.replace("/", ""); // "schema" or "data"

  if (!tableName || !type) {
    throw new McpError(ErrorCode.InvalidRequest, "Invalid resource URI");
  }

  try {
    if (type === "schema") {
      const [rows] = await pool.query(`DESCRIBE ??`, [tableName]);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } else if (type === "data") {
      const [rows] = await pool.query(`SELECT * FROM ?? LIMIT 100`, [tableName]);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } else {
      throw new McpError(ErrorCode.InvalidRequest, "Unknown resource type");
    }
  } catch (error: any) {
    throw new McpError(ErrorCode.InternalError, `Error reading resource: ${error.message}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MySQL MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
