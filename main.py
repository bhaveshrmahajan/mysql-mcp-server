import sys
import os
import json
import asyncio
from urllib.parse import urlparse, unquote
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn
import aiomysql

from mcp.server import Server
from mcp.server.models import InitializationOptions
import mcp.server.stdio
from mcp.server.sse import SseServerTransport
import mcp.types as types

# Initialize low-level MCP server
server = Server("mysql-server")

# Global MySQL connection pool
pool: aiomysql.Pool | None = None

async def init_pool(db_url: str):
    global pool
    url = urlparse(db_url)
    username = unquote(url.username) if url.username else None
    password = unquote(url.password) if url.password else None
    db = url.path.lstrip('/')
    
    # Create the connection pool with autocommit enabled
    pool = await aiomysql.create_pool(
        host=url.hostname,
        port=url.port or 3306,
        user=username,
        password=password,
        db=db,
        autocommit=True
    )
    print("Database connection pool initialized successfully.")

def escape_identifier(identifier: str) -> str:
    """Escapes MySQL identifiers like table and column names to prevent SQL injection."""
    return f"`{identifier.replace('`', '``')}`"

async def db_query(query: str, params=None, is_write=False):
    """Executes a query using the connection pool."""
    global pool
    if not pool:
        raise ValueError("Database connection pool is not initialized")
    
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, params)
            if is_write:
                return cur.rowcount
            else:
                return await cur.fetchall()

def is_select_or_show_or_describe(query: str) -> bool:
    """Checks if a SQL query is read-only."""
    q = query.strip().lower()
    return q.startswith("select") or q.startswith("show") or q.startswith("describe")

# MCP Tools List Handler
@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="list-tables",
            description="List all tables in the database",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="describe-table",
            description="Get the schema of a specific table",
            inputSchema={
                "type": "object",
                "properties": {
                    "tableName": {
                        "type": "string",
                        "description": "The name of the table to describe",
                    }
                },
                "required": ["tableName"],
            }
        ),
        types.Tool(
            name="create-table",
            description="Create a new table in the database",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The CREATE TABLE SQL query",
                    }
                },
                "required": ["query"],
            }
        ),
        types.Tool(
            name="insert-row",
            description="Insert a new row into a table",
            inputSchema={
                "type": "object",
                "properties": {
                    "tableName": {
                        "type": "string",
                        "description": "The name of the table to insert into",
                    },
                    "data": {
                        "type": "object",
                        "description": "The data to insert as a JSON object (key-value pairs matching column names)",
                    }
                },
                "required": ["tableName", "data"],
            }
        ),
        types.Tool(
            name="update-row",
            description="Update existing rows in a table",
            inputSchema={
                "type": "object",
                "properties": {
                    "tableName": {
                        "type": "string",
                        "description": "The name of the table to update",
                    },
                    "data": {
                        "type": "object",
                        "description": "The data to update as a JSON object (key-value pairs)",
                    },
                    "where": {
                        "type": "object",
                        "description": "The WHERE clause conditions as a JSON object (key-value pairs)",
                    }
                },
                "required": ["tableName", "data", "where"],
            }
        ),
        types.Tool(
            name="delete-row",
            description="Delete rows from a table",
            inputSchema={
                "type": "object",
                "properties": {
                    "tableName": {
                        "type": "string",
                        "description": "The name of the table to delete from",
                    },
                    "where": {
                        "type": "object",
                        "description": "The WHERE clause conditions as a JSON object (key-value pairs)",
                    }
                },
                "required": ["tableName", "where"],
            }
        ),
        types.Tool(
            name="execute-query",
            description="Execute a read-only SQL query",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The SQL query to execute",
                    }
                },
                "required": ["query"],
            }
        ),
        types.Tool(
            name="execute-write-query",
            description="Execute a write (INSERT, UPDATE, DELETE, etc.) SQL query",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The SQL query to execute",
                    }
                },
                "required": ["query"],
            }
        ),
        types.Tool(
            name="create-database",
            description="Create a new database",
            inputSchema={
                "type": "object",
                "properties": {
                    "databaseName": {
                        "type": "string",
                        "description": "The name of the new database to create",
                    }
                },
                "required": ["databaseName"],
            }
        ),
        types.Tool(
            name="list-procedures",
            description="List all stored procedures in the database",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="show-procedure",
            description="Show the CREATE statement for a specific stored procedure",
            inputSchema={
                "type": "object",
                "properties": {
                    "procedureName": {
                        "type": "string",
                        "description": "The name of the procedure to show",
                    }
                },
                "required": ["procedureName"],
            }
        ),
        types.Tool(
            name="list-functions",
            description="List all stored functions in the database",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="show-function",
            description="Show the CREATE statement for a specific stored function",
            inputSchema={
                "type": "object",
                "properties": {
                    "functionName": {
                        "type": "string",
                        "description": "The name of the function to show",
                    }
                },
                "required": ["functionName"],
            }
        ),
        types.Tool(
            name="list-triggers",
            description="List all triggers in the database",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="show-trigger",
            description="Show the CREATE statement for a specific trigger",
            inputSchema={
                "type": "object",
                "properties": {
                    "triggerName": {
                        "type": "string",
                        "description": "The name of the trigger to show",
                    }
                },
                "required": ["triggerName"],
            }
        ),
        types.Tool(
            name="list-views",
            description="List all views in the database",
            inputSchema={"type": "object", "properties": {}}
        ),
        types.Tool(
            name="show-view",
            description="Show the CREATE statement for a specific view",
            inputSchema={
                "type": "object",
                "properties": {
                    "viewName": {
                        "type": "string",
                        "description": "The name of the view to show",
                    }
                },
                "required": ["viewName"],
            }
        ),
    ]

# MCP Call Tool Handler
@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list[types.TextContent]:
    if not arguments:
        arguments = {}

    try:
        if name == "list-tables":
            rows = await db_query("SHOW TABLES")
            tables = [list(row.values())[0] for row in rows]
            return [types.TextContent(type="text", text=f"Tables in database:\n" + "\n".join(tables))]

        elif name == "describe-table":
            table_name = arguments.get("tableName")
            if not table_name:
                raise ValueError("tableName is required")
            rows = await db_query(f"DESCRIBE {escape_identifier(table_name)}")
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        elif name == "create-table":
            query = arguments.get("query")
            if not query:
                raise ValueError("query is required")
            await db_query(query, is_write=True)
            return [types.TextContent(type="text", text="Table created successfully")]

        elif name == "insert-row":
            table_name = arguments.get("tableName")
            data = arguments.get("data")
            if not table_name or not data:
                raise ValueError("tableName and data are required")
            
            cols = [escape_identifier(k) for k in data.keys()]
            placeholders = ["%s"] * len(data)
            query = f"INSERT INTO {escape_identifier(table_name)} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
            await db_query(query, list(data.values()), is_write=True)
            return [types.TextContent(type="text", text=f"Row inserted successfully into {table_name}")]

        elif name == "update-row":
            table_name = arguments.get("tableName")
            data = arguments.get("data")
            where = arguments.get("where")
            if not table_name or not data or not where:
                raise ValueError("tableName, data, and where are required")
            
            set_cols = [f"{escape_identifier(k)} = %s" for k in data.keys()]
            where_cols = [f"{escape_identifier(k)} = %s" for k in where.keys()]
            if not where_cols:
                raise ValueError("WHERE clause is required for update-row")
            
            query = f"UPDATE {escape_identifier(table_name)} SET {', '.join(set_cols)} WHERE {' AND '.join(where_cols)}"
            values = list(data.values()) + list(where.values())
            affected = await db_query(query, values, is_write=True)
            return [types.TextContent(type="text", text=f"Rows updated: {affected}")]

        elif name == "delete-row":
            table_name = arguments.get("tableName")
            where = arguments.get("where")
            if not table_name or not where:
                raise ValueError("tableName and where are required")
            
            where_cols = [f"{escape_identifier(k)} = %s" for k in where.keys()]
            if not where_cols:
                raise ValueError("WHERE clause is required for delete-row")
            
            query = f"DELETE FROM {escape_identifier(table_name)} WHERE {' AND '.join(where_cols)}"
            affected = await db_query(query, list(where.values()), is_write=True)
            return [types.TextContent(type="text", text=f"Rows deleted: {affected}")]

        elif name == "execute-query":
            query = arguments.get("query")
            if not query:
                raise ValueError("query is required")
            if not is_select_or_show_or_describe(query):
                raise ValueError("Only SELECT, SHOW, and DESCRIBE queries are allowed for this tool. Use execute-write-query for modifications.")
            rows = await db_query(query)
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        elif name == "execute-write-query":
            query = arguments.get("query")
            if not query:
                raise ValueError("query is required")
            result = await db_query(query, is_write=True)
            return [types.TextContent(type="text", text=json.dumps({"affectedRows": result}, indent=2))]

        elif name == "create-database":
            database_name = arguments.get("databaseName")
            if not database_name:
                raise ValueError("databaseName is required")
            await db_query(f"CREATE DATABASE {escape_identifier(database_name)}", is_write=True)
            return [types.TextContent(type="text", text=f"Database '{database_name}' created successfully")]

        elif name == "list-procedures":
            rows = await db_query("SHOW PROCEDURE STATUS WHERE Db = DATABASE()")
            procedures = [row.get("Name") for row in rows if row.get("Name")]
            return [types.TextContent(type="text", text="Stored Procedures:\n" + "\n".join(procedures))]

        elif name == "show-procedure":
            proc_name = arguments.get("procedureName")
            if not proc_name:
                raise ValueError("procedureName is required")
            rows = await db_query(f"SHOW CREATE PROCEDURE {escape_identifier(proc_name)}")
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        elif name == "list-functions":
            rows = await db_query("SHOW FUNCTION STATUS WHERE Db = DATABASE()")
            functions = [row.get("Name") for row in rows if row.get("Name")]
            return [types.TextContent(type="text", text="Stored Functions:\n" + "\n".join(functions))]

        elif name == "show-function":
            func_name = arguments.get("functionName")
            if not func_name:
                raise ValueError("functionName is required")
            rows = await db_query(f"SHOW CREATE FUNCTION {escape_identifier(func_name)}")
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        elif name == "list-triggers":
            rows = await db_query("SHOW TRIGGERS")
            triggers = [row.get("Trigger") for row in rows if row.get("Trigger")]
            return [types.TextContent(type="text", text="Triggers:\n" + "\n".join(triggers))]

        elif name == "show-trigger":
            trigger_name = arguments.get("triggerName")
            if not trigger_name:
                raise ValueError("triggerName is required")
            rows = await db_query(f"SHOW CREATE TRIGGER {escape_identifier(trigger_name)}")
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        elif name == "list-views":
            rows = await db_query("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
            views = [list(row.values())[0] for row in rows]
            return [types.TextContent(type="text", text="Views:\n" + "\n".join(views))]

        elif name == "show-view":
            view_name = arguments.get("viewName")
            if not view_name:
                raise ValueError("viewName is required")
            rows = await db_query(f"SHOW CREATE VIEW {escape_identifier(view_name)}")
            return [types.TextContent(type="text", text=json.dumps(rows, indent=2, default=str))]

        else:
            raise ValueError(f"Tool not found: {name}")

    except Exception as e:
        # Return error as content so connection remains stable
        return [types.TextContent(type="text", text=f"Error executing {name}: {str(e)}")]

# MCP Prompts List Handler
@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return [
        types.Prompt(
            name="analyze-table",
            description="Analyze a table's structure and sample data",
            arguments=[
                types.PromptArgument(
                    name="tableName",
                    description="The name of the table to analyze",
                    required=True,
                )
            ]
        ),
        types.Prompt(
            name="optimize-query",
            description="Analyze and optimize a SQL query",
            arguments=[
                types.PromptArgument(
                    name="query",
                    description="The SQL query to optimize",
                    required=True,
                )
            ]
        )
    ]

# MCP Get Prompt Handler
@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict | None) -> types.GetPromptResult:
    if not arguments:
        arguments = {}

    if name == "analyze-table":
        table_name = arguments.get("tableName")
        if not table_name:
            raise ValueError("tableName argument is required")
        
        try:
            schema_rows = await db_query(f"DESCRIBE {escape_identifier(table_name)}")
            data_rows = await db_query(f"SELECT * FROM {escape_identifier(table_name)} LIMIT 5")
            
            schema_str = json.dumps(schema_rows, indent=2, default=str)
            data_str = json.dumps(data_rows, indent=2, default=str)
            
            return types.GetPromptResult(
                messages=[
                    types.PromptMessage(
                        role="user",
                        content=types.TextContent(
                            type="text",
                            text=f"Please analyze the structure and sample data for the table '{table_name}'.\n\n"
                                 f"Schema:\n{schema_str}\n\n"
                                 f"Sample Data (first 5 rows):\n{data_str}\n\n"
                                 f"Provide insights on the schema design, potential relationships, and data distribution.\n"
                        )
                    )
                ]
            )
        except Exception as e:
            raise RuntimeError(f"Error fetching table details: {str(e)}")

    elif name == "optimize-query":
        query = arguments.get("query")
        if not query:
            raise ValueError("query argument is required")
        
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=f"Please analyze the following SQL query for performance optimization opportunities. "
                             f"explain the query plan if possible involved tables.\n\n"
                             f"Query:\n{query}\n\n"
                             f"Suggest improvements such as indexing, query rewriting of joins, or structural changes.\n"
                    )
                )
            ]
        )

    else:
        raise ValueError(f"Prompt not found: {name}")

# MCP Resources List Handler
@server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    if not pool:
        return []
    try:
        rows = await db_query("SHOW TABLES")
        tables = [list(row.values())[0] for row in rows]
        
        resources = []
        for table in tables:
            resources.append(
                types.Resource(
                    uri=f"mysql://{table}/schema",
                    name=f"{table} Schema",
                    mimeType="application/json",
                    description=f"Schema for table {table}",
                )
            )
            resources.append(
                types.Resource(
                    uri=f"mysql://{table}/data",
                    name=f"{table} Data",
                    mimeType="application/json",
                    description=f"First 100 rows of table {table}",
                )
            )
        return resources
    except Exception as e:
        print(f"Error listing resources: {e}", file=sys.stderr)
        return []

# MCP Read Resource Handler
@server.read_resource()
async def handle_read_resource(uri: str) -> types.ReadResourceResult:
    try:
        url = urlparse(uri)
        table_name = url.hostname
        type_part = url.path.lstrip("/")
        
        if not table_name or not type_part:
            raise ValueError("Invalid resource URI")
            
        if type_part == "schema":
            rows = await db_query(f"DESCRIBE {escape_identifier(table_name)}")
            text_data = json.dumps(rows, indent=2, default=str)
        elif type_part == "data":
            rows = await db_query(f"SELECT * FROM {escape_identifier(table_name)} LIMIT 100")
            text_data = json.dumps(rows, indent=2, default=str)
        else:
            raise ValueError("Unknown resource type")
            
        return types.ReadResourceResult(
            contents=[
                types.TextResourceContents(
                    uri=uri,
                    mime_type="application/json",
                    text=text_data
                )
            ]
        )
    except Exception as e:
        raise RuntimeError(f"Error reading resource: {str(e)}")

# Initialize FastAPI Lifespan (setup/teardown of connection pool)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    db_url = os.environ.get("MYSQL_URL") or os.environ.get("DATABASE_URL")
    if db_url:
        print(f"FastAPI startup: initializing MySQL pool...")
        await init_pool(db_url)
    else:
        print("Warning: MYSQL_URL / DATABASE_URL not set in environment.", file=sys.stderr)
    yield
    if pool:
        print("FastAPI shutdown: closing MySQL pool...")
        pool.close()
        await pool.wait_closed()

# Create FastAPI app
app = FastAPI(lifespan=lifespan)
sse = SseServerTransport("/messages/")

@app.get("/sse")
async def handle_sse(request: Request):
    async with sse.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await server.run(
            streams[0],
            streams[1],
            InitializationOptions(
                server_name="mysql-server",
                server_version="1.0.0",
                capabilities=types.ServerCapabilities(
                    resources=types.ResourcesCapability(),
                    tools=types.ToolsCapability(),
                    prompts=types.PromptsCapability(),
                ),
            ),
        )

@app.post("/messages/")
async def handle_messages(request: Request):
    return await sse.handle_post_message(request.scope, request.receive, request._send)

@app.get("/health")
async def health_check():
    return {"status": "ok", "database_connected": pool is not None}

@app.get("/")
async def root():
    return HTMLResponse(
        content="""
        <html>
            <head>
                <title>MySQL MCP Server (Python)</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        max-width: 800px;
                        margin: 40px auto;
                        padding: 0 20px;
                        line-height: 1.6;
                        background: #121214;
                        color: #e1e1e6;
                    }
                    h1 { color: #00b4d8; }
                    pre { background: #1a1a1e; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #29292e; }
                    .status { display: inline-block; padding: 5px 10px; border-radius: 15px; font-weight: bold; }
                    .status.ok { background: #078a63; color: white; }
                </style>
            </head>
            <body>
                <h1>MySQL MCP Server (Python)</h1>
                <p>Status: <span class="status ok">Running</span></p>
                <p>This server exposes a Model Context Protocol (MCP) interface over SSE.</p>
                <p><strong>SSE Endpoint:</strong> <code>/sse</code></p>
                <p><strong>Messages Endpoint:</strong> <code>/messages/</code></p>
                <h2>Claude Desktop Configuration</h2>
                <pre>{
  "mcpServers": {
    "mysql-sse": {
      "command": "uv",
      "args": [
        "run",
        "python",
        "-m",
        "mcp.client.sse",
        "http://localhost:8000/sse"
      ]
    }
  }
}</pre>
            </body>
        </html>
        """
    )

async def run_stdio(db_url: str):
    global pool
    await init_pool(db_url)
    try:
        print("MySQL MCP Server running on stdio", file=sys.stderr)
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="mysql-server",
                    server_version="1.0.0",
                    capabilities=types.ServerCapabilities(
                        resources=types.ResourcesCapability(),
                        tools=types.ToolsCapability(),
                        prompts=types.PromptsCapability(),
                    ),
                ),
            )
    finally:
        if pool:
            pool.close()
            await pool.wait_closed()

if __name__ == "__main__":
    port = None
    db_url = None
    
    # Parse CLI arguments manually
    args = sys.argv[1:]
    idx = 0
    while idx < len(args):
        arg = args[idx]
        if arg in ("--port", "-p"):
            if idx + 1 < len(args):
                port = int(args[idx + 1])
                idx += 2
                continue
        elif arg.startswith("mysql://"):
            db_url = arg
        idx += 1

    if port is not None:
        if db_url:
            os.environ["MYSQL_URL"] = db_url
        print(f"Starting FastAPI server on port {port}...")
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
    else:
        if not db_url:
            print("Usage: python main.py <database-url> [or --port <port> <database-url>]", file=sys.stderr)
            sys.exit(1)
        asyncio.run(run_stdio(db_url))
