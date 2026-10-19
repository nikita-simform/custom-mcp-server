import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import z from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "Example MCP Server",
  description: "An example MCP server implemented in TypeScript",
  version: "1.0.0",
});

async function createUser(params: {
  name: string;
  email: string;
}): Promise<number> {
  const users = await import("./data/users.json", {
    with: {
      type: "json",
    },
  }).then((module) => module.default);

  const id = users.length + 1;
  users.push({ id, name: params.name, email: params.email });

  // Persist the updated users array back to the file
  writeFileSync(
    join(__dirname, "./data/users.json"),
    JSON.stringify(users, null, 2),
  );

  return id;
}

server.registerTool(
  "create-user",
  {
    description: "Creates a new user with the given name and email",
    inputSchema: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  },

  async (params) => {
    try {
      const id = await createUser(params);
      return {
        content: [
          {
            type: "text",
            text: `User created successfully: ${id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

//sampling
server.registerTool(
  "generate-random-user",
  {
    description: "Generates a random user with a realistic name and email",
  },
  async () => {
    try {
      const res = await server.server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: "Generate fake user data. The user should have a realistic name and email. Return this data as JSON object with no other text or formatting, so it can be used as JSON.parse() input.",
                },
              },
            ],
            maxTokens: 1024,
          },
        },
        CreateMessageResultSchema,
      );
      if (res.content.type !== "text") {
        return {
          content: [
            {
              type: "text",
              text: "Failed to generate random user: response content is not text",
            },
          ],
        };
      }

      const userData = JSON.parse(
        res.content.text
          .trim()
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      const id = await createUser(userData);

      return {
        content: [
          {
            type: "text",
            text: `Generated user with id ${id}: ${JSON.stringify(userData)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating random user: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.registerResource(
  "user-list",
  "users://all",
  {
    description: "A list of all users",
  },
  async (uri) => {
    const users = await import("./data/users.json", {
      with: {
        type: "json",
      },
    }).then((module) => module.default);

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(users, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  },
);

server.registerPrompt(
  "generate-fake-user",
  {
    description: "Generates a fake user with the given name",
    argsSchema: {
      name: z.string(),
    },
  },
  async (params) => {
    const { name } = params;
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a fake user with the name ${name}. The user should have a realistic name, email, and id.`,
          },
        },
      ],
    };
  },
);
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
