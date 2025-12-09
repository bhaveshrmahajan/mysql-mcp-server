import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "build", "index.js");

// Real DB URL provided by user
const dbUrl = "mysql://root:root1234@localhost:3306/sqlpractices";

console.log(`Starting server at ${serverPath}...`);
const server = spawn("node", [serverPath, dbUrl], {
  stdio: ["pipe", "pipe", "inherit"], // Pipe stdin/stdout, inherit stderr for logs
});

let buffer = "";

server.stdout.on("data", (data) => {
  const output = data.toString();
  console.log("Server Output:", output);

  buffer += output;
  if (buffer.includes("\n")) {
    try {
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && msg.result) {
            console.log("✅ Verification Success: Server initialized!");

            // Now test create-database
            const createDbRequest = {
              jsonrpc: "2.0",
              id: 2,
              method: "tools/call",
              params: {
                name: "create-database",
                arguments: {
                  databaseName: "test_mcp_created_db"
                }
              }
            };
            console.log("Testing create-database tool...");
            server.stdin.write(JSON.stringify(createDbRequest) + "\n");
          } else if (msg.id === 2) {
            if (msg.error) {
              // It might fail if it already exists, which is fine for verification of "check"
              console.log("Create Database result:", msg.error.message || msg.error);
            } else {
              console.log("✅ Create Database Success:", JSON.stringify(msg.result));
            }

            // Now list prompts
            const listPromptsRequest = {
              jsonrpc: "2.0",
              id: 3,
              method: "prompts/list",
              params: {}
            };
            console.log("Listing prompts...");
            server.stdin.write(JSON.stringify(listPromptsRequest) + "\n");
          } else if (msg.id === 3) {
            console.log("Prompts List Result:");
            console.log(JSON.stringify(msg.result, null, 2));
            process.exit(0);
          }
        } catch (e) {
          // ignore partial json
        }
      }
    } catch (e) {
      // Partial line or not JSON, ignore
    }
  }
});

// Send initialize request
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "tester",
      version: "1.0.0",
    },
  },
};

console.log("Sending initialize request...");
server.stdin.write(JSON.stringify(initRequest) + "\n");

setTimeout(() => {
  console.error("❌ Verification Timeout: Server did not respond in time.");
  process.exit(1);
}, 5000);
