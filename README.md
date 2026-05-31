# MySQL MCP Server (Python & FastAPI)

A powerful **Model Context Protocol (MCP)** server that connects your AI assistant (like **Claude Desktop**) directly to your **MySQL** database. This server is written in Python, uses `aiomysql` for asynchronous database pooling, and is powered by FastAPI to support both standard STDIO and HTTP-based SSE transports.

---

## 🚀 Features

This server implements a wide range of MCP capabilities to give you full visibility and control over your MySQL database.

### 🛠️ Tools

**Table Management**
*   `list-tables`: List all tables in the database.
*   `describe-table`: Get the schema (columns, types, keys) of a specific table.
*   `create-table`: Create a new table using a SQL query.

**Data Operations (CRUD)**
*   `insert-row`: Insert a new row into a table using JSON data.
*   `update-row`: Update existing rows with a convenient JSON-based WHERE clause.
*   `delete-row`: Delete rows with a safety-first JSON-based WHERE clause.

**Query Execution**
*   `execute-query`: Execute **read-only** SQL queries (`SELECT`, `SHOW`, `DESCRIBE`). Safe for exploration.
*   `execute-write-query`: Execute **write** SQL queries (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, etc.). Use with caution.

**Database Administration**
*   `create-database`: Create a new database.

**Advanced Objects Inspection**
*   **Stored Procedures**: `list-procedures`, `show-procedure` (view CREATE statement).
*   **Functions**: `list-functions`, `show-function` (view CREATE statement).
*   **Triggers**: `list-triggers`, `show-trigger`.
*   **Views**: `list-views`, `show-view`.

### 📦 Resources

Access database content directly as standard MCP resources:
*   `mysql://<table_name>/schema`: View the full JSON schema of a table.
*   `mysql://<table_name>/data`: View the first 100 rows of a table as JSON.

### 💬 Prompts

Pre-built templates to help the AI perform complex tasks:
*   **`analyze-table`**: "Analyze the structure and sample data for table 'Users'..."
    *   *Automatically fetches schema and sample data to provide insights.*
*   **`optimize-query`**: "Analyze this query for performance..."
    *   *Helps you write faster, more efficient SQL.*

---

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mysql-mcp-server
    ```

2.  **Install the dependencies:**
    Ensure you have Python 3.10+ installed. Install requirements using `pip`:
    ```bash
    pip install -r requirements.txt
    ```

---

## ⚙️ Running the Server

The server can run in two modes:

### Mode 1: STDIO Transport (Local Integration)
Directly run the script with your database URL as the argument. This is the mode used by desktop clients like Claude Desktop.
```bash
python main.py mysql://user:password@localhost:3306/database_name
```

### Mode 2: SSE Transport (Web / Networked Server via FastAPI)
Run the FastAPI web server by specifying a port:
```bash
python main.py --port 8000 mysql://user:password@localhost:3306/database_name
```
Alternatively, you can set the environment variable and run via standard `uvicorn`:
```bash
# On Windows (cmd):
set MYSQL_URL=mysql://user:password@localhost:3306/database_name
# On Windows (PowerShell):
$env:MYSQL_URL="mysql://user:password@localhost:3306/database_name"
# On Linux/macOS:
export MYSQL_URL="mysql://user:password@localhost:3306/database_name"

uvicorn main:app --host 0.0.0.0 --port 8000
```
Visit `http://localhost:8000` to view the server status and connection dashboard.

---

## 🛠️ Claude Desktop Configuration

Add the following block to your `claude_desktop_config.json` depending on your preferred transport:

### Option A: Direct STDIO Connection (No server to run in background)
```json
{
  "mcpServers": {
    "mysql-stdio": {
      "command": "python",
      "args": [
        "c:/Users/bhave/OneDrive/Desktop/MySQL MCP Server/main.py",
        "mysql://user:password@localhost:3306/database_name"
      ]
    }
  }
}
```
*Note: Ensure you use the absolute path to `main.py` on your machine.*

### Option B: Remote SSE Connection (Requires running FastAPI server on port 8000)
```json
{
  "mcpServers": {
    "mysql-sse": {
      "command": "python",
      "args": [
        "-m",
        "mcp.client.sse",
        "http://localhost:8000/sse"
      ]
    }
  }
}
```

---

## 💡 Usage Examples

Once connected in Claude, you can use queries like:

*   **Exploration**: "What tables are in my database?"
*   **Schema**: "Show me the schema for the `orders` table."
*   **Data Analysis**: "Select the top 5 customers who spent the most money."
*   **Modification**: "Insert a new user named 'Alice' into the `users` table."
*   **Optimization**: "Analyze this query and tell me why it's slow: `SELECT * FROM logs`"

---

## 🔒 Security Note
This server has powerful capabilities, including write access (`execute-write-query`, `delete-row`, etc.). Always ensure you are connecting to a database where you have appropriate permissions, and be careful when asking the AI to modify data.

## 📄 License
MIT
