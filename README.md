# MySQL MCP Server

A powerful **Model Context Protocol (MCP)** server that connects your AI assistant (like **Claude Desktop**) directly to your **MySQL** database. This server enables safe, controlled access to inspect schemas, query data, and even perform administrative tasks, all through natural language.

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

## 📦 Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mysql-mcp-server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the server:**
    ```bash
    npm run build
    ```

---

## ⚙️ Configuration

### 1. Environment Variables
The server uses `mysql2` and requires connection details. You can pass these via environment variables.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_HOST` | Database hostname | `localhost` |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | - |
| `DB_PORT` | Database port | `3306` |

### 2. Claude Desktop Config
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mysql-mcp-server/dist/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_NAME": "your_database",
        "DB_PORT": "3306"
      }
    }
  }
}
```
*Note: Make sure to replace `/ABSOLUTE/PATH/TO/...` with the actual path to your project.*

---

## 💡 Usage Examples

Once connected, you can ask Claude questions like:

*   **Exploration**: "What tables are in my database?"
*   **Schema**: "Show me the schema for the `orders` table."
*   **Data Analysis**: "Select the top 5 customers who spent the most money."
*   **Modification**: "Insert a new user named 'Alice' into the `users` table."
*   **Optimization**: "Analyze this query and tell me why it's slow: `SELECT * FROM logs`"

---

## 🔒 Security Note
This server has powerful capabilities, including write access (`execute-write-query`, `delete-row`, etc.). Always ensure you are connecting to a database where you have appropriate permissions, and be careful when asking the AI to modify data.

## 📄 License
ISC
