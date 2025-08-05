import { MCPToolResult } from "../types";

const GITHUB_API_BASE = "https://api.github.com";
const WP_REPO = "WordPress/wordpress-develop"; // Main development repository
const WP_BRANCH = "trunk"; // Main development branch

// GitHub API helper function
async function githubApiCall(endpoint: string): Promise<any> {
  const url = `${GITHUB_API_BASE}${endpoint}`;
  console.log(`🐙 GitHub API call: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "WP-Aggregator-AI/1.0.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`✅ GitHub API response received`);
    return data;
  } catch (error) {
    console.error("❌ GitHub API error:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        throw new Error(
          "GitHub API authentication failed. Rate limits may apply"
        );
      } else if (
        error.message.includes("403") ||
        error.message.includes("forbidden")
      ) {
        throw new Error(
          "GitHub API access denied. Rate limit exceeded or repository access restricted"
        );
      } else if (error.message.includes("404")) {
        throw new Error("GitHub API endpoint not found");
      } else if (error.message.includes("422")) {
        throw new Error("GitHub API validation error. Check search parameters");
      } else if (
        error.message.includes("500") ||
        error.message.includes("502")
      ) {
        throw new Error(
          "GitHub API server error. Service temporarily unavailable"
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("GitHub API request timeout");
      } else if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("Network error while accessing GitHub API");
      } else {
        throw new Error(`GitHub API error: ${error.message}`);
      }
    }

    throw new Error("Unknown error occurred while accessing GitHub API");
  }
}

// Search WordPress codebase
export async function searchWordPressCode(
  query: string,
  path?: string
): Promise<MCPToolResult> {
  try {
    console.log(
      `🔍 Searching WordPress code for: "${query}" in path: ${
        path || "all files"
      }`
    );

    let searchQuery = `${query} repo:${WP_REPO}`;
    if (path) {
      searchQuery += ` path:${path}`;
    }
    const endpoint = `/search/code?q=${encodeURIComponent(
      searchQuery
    )}&sort=indexed&order=desc`;

    const data = await githubApiCall(endpoint);

    const results =
      data.items?.slice(0, 10).map((item: any) => ({
        name: item.name,
        path: item.path,
        url: item.html_url,
        score: item.score,
        matches:
          item.text_matches?.map((match: any) => ({
            fragment: match.fragment,
            property: match.property,
          })) || [],
      })) || [];

    const resultText = results
      .map((result: any, index: number) => {
        const matchesText =
          result.matches.length > 0
            ? `Matches: ${result.matches
                .map((m: any) => m.fragment)
                .join(", ")}\n`
            : "";
        return `${index + 1}. **${result.path}**\n   Score: ${
          result.score
        }\n   URL: ${result.url}\n   ${matchesText}`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${data.total_count} code matches in WordPress codebase:\n\n${resultText}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    console.error("Error searching WordPress code:", error);

    let errorMessage = "Failed to search WordPress codebase";
    let errorDetails = "";

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        errorMessage = "GitHub API rate limit exceeded";
        errorDetails = "Please wait before searching again";
      } else if (error.message.includes("authentication")) {
        errorMessage = "GitHub API authentication issue";
        errorDetails = "Rate limits may be affecting search results";
      } else if (error.message.includes("validation")) {
        errorMessage = "Invalid search parameters";
        errorDetails = "Please check your search query";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Search request timeout";
        errorDetails = "GitHub may be slow to respond";
      } else if (error.message.includes("network")) {
        errorMessage = "Network error during search";
        errorDetails = "Check your internet connection";
      } else {
        errorDetails = error.message;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `🔍 ${errorMessage}${
            errorDetails ? `\n💡 ${errorDetails}` : ""
          }\n\nQuery: "${query}"${path ? `\nPath: ${path}` : ""}`,
        },
      ],
      isError: true,
    };
  }
}

// Get WordPress file content
export async function getWordPressFile(
  filePath: string
): Promise<MCPToolResult> {
  try {
    console.log(`📄 Getting WordPress file: ${filePath}`);

    const endpoint = `/repos/${WP_REPO}/contents/${filePath}?ref=${WP_BRANCH}`;
    const data = await githubApiCall(endpoint);

    if (data.type !== "file") {
      throw new Error(`Path ${filePath} is not a file`);
    }

    // Decode base64 content
    const content = atob(data.content.replace(/\s/g, ""));
    const lines = content.split("\n");
    const totalLines = lines.length;

    // Truncate very large files
    const maxLines = 500;
    const truncated = totalLines > maxLines;
    let displayContent = content;
    if (truncated) {
      displayContent =
        lines.slice(0, maxLines).join("\n") +
        "\n\n... (truncated, showing first 500 lines of " +
        totalLines +
        ")";
    }

    return {
      content: [
        {
          type: "text",
          text: `**File: ${filePath}** (${
            data.size
          } bytes, ${totalLines} lines)\n**URL:** ${
            data.html_url
          }\n\n\`\`\`${getFileExtension(filePath)}\n${displayContent}\n\`\`\``,
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting WordPress file ${filePath}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
}

// Get WordPress directory listing
export async function getWordPressDirectory(
  dirPath: string = ""
): Promise<MCPToolResult> {
  try {
    console.log(`📁 Getting WordPress directory: ${dirPath || "root"}`);

    const endpoint = `/repos/${WP_REPO}/contents/${dirPath}?ref=${WP_BRANCH}`;
    const data = await githubApiCall(endpoint);

    if (!Array.isArray(data)) {
      throw new Error(`Path ${dirPath} is not a directory`);
    }

    const items = data.map((item: any) => ({
      name: item.name,
      type: item.type,
      path: item.path,
      size: item.size || 0,
      url: item.html_url,
    }));

    const directories = items.filter((item) => item.type === "dir");
    const files = items.filter((item) => item.type === "file");

    return {
      content: [
        {
          type: "text",
          text:
            `**Directory: /${dirPath}** (${directories.length} directories, ${files.length} files)\n\n` +
            `**Directories:**\n${directories
              .map((d) => `📁 ${d.name}/`)
              .join("\n")}\n\n` +
            `**Files:**\n${files
              .map((f) => `📄 ${f.name} (${f.size} bytes)`)
              .join("\n")}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting WordPress directory ${dirPath}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
}

// Get WordPress commit information
export async function getWordPressCommit(sha: string): Promise<MCPToolResult> {
  try {
    console.log(`🔄 Getting WordPress commit: ${sha}`);

    const endpoint = `/repos/${WP_REPO}/commits/${sha}`;
    const data = await githubApiCall(endpoint);

    const commit = {
      sha: data.sha.substring(0, 8),
      message: data.commit.message,
      author: data.commit.author.name,
      date: data.commit.author.date,
      url: data.html_url,
      files:
        data.files?.map((file: any) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
        })) || [],
    };

    return {
      content: [
        {
          type: "text",
          text:
            `**Commit ${commit.sha}** by ${commit.author}\n**Date:** ${commit.date}\n**URL:** ${commit.url}\n\n` +
            `**Message:**\n${commit.message}\n\n` +
            `**Files Changed (${commit.files.length}):**\n${commit.files
              .map(
                (f: any) =>
                  `${
                    f.status === "added"
                      ? "➕"
                      : f.status === "deleted"
                      ? "➖"
                      : "📝"
                  } ${f.filename} (+${f.additions}/-${f.deletions})`
              )
              .join("\n")}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting WordPress commit ${sha}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
}

// Search WordPress commit history
export async function searchWordPressCommits(
  query: string
): Promise<MCPToolResult> {
  try {
    console.log(`🔍 Searching WordPress commits for: "${query}"`);

    const searchQuery = `${query} repo:${WP_REPO}`;
    const endpoint = `/search/commits?q=${encodeURIComponent(
      searchQuery
    )}&sort=committer-date&order=desc`;

    const data = await githubApiCall(endpoint);

    const commits =
      data.items?.slice(0, 10).map((commit: any) => ({
        sha: commit.sha.substring(0, 8),
        message: commit.commit.message.split("\n")[0], // First line only
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url,
        score: commit.score,
      })) || [];

    const commitsText = commits
      .map(
        (commit: any, index: number) =>
          `${index + 1}. **${commit.sha}** by ${commit.author} (${
            commit.date
          })\n   ${commit.message}\n   Score: ${commit.score}\n   ${
            commit.url
          }\n`
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${data.total_count} commit matches in WordPress history:\n\n${commitsText}`,
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error searching WordPress commits: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
}

// Helper function to get file extension for syntax highlighting
function getFileExtension(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "php":
      return "php";
    case "js":
      return "javascript";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "txt":
      return "text";
    case "xml":
      return "xml";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "text";
  }
}

// Define GitHub tools for Gemini
export function getGitHubTools() {
  return [
    {
      name: "search_wordpress_code",
      description:
        "Search for code patterns, functions, classes, or text in the WordPress codebase. Use this to find where specific functionality is implemented.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query for code (function names, class names, text patterns, etc.)",
          },
          path: {
            type: "string",
            description:
              "Optional: Limit search to specific path (e.g., 'src/wp-includes' or 'tests/phpunit')",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_wordpress_file",
      description:
        "Get the complete content of a specific file in the WordPress codebase. Use this to examine implementation details.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description:
              "Path to the file relative to WordPress root (e.g., 'src/wp-includes/post.php')",
          },
        },
        required: ["filePath"],
      },
    },
    {
      name: "get_wordpress_directory",
      description:
        "List contents of a directory in the WordPress codebase. Use this to explore the codebase structure.",
      parameters: {
        type: "object",
        properties: {
          dirPath: {
            type: "string",
            description:
              "Path to directory relative to WordPress root (e.g., 'src/wp-includes' or leave empty for root)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_wordpress_commit",
      description:
        "Get detailed information about a specific WordPress commit including changed files and diff.",
      parameters: {
        type: "object",
        properties: {
          sha: {
            type: "string",
            description: "Git commit SHA hash (full or abbreviated)",
          },
        },
        required: ["sha"],
      },
    },
    {
      name: "search_wordpress_commits",
      description:
        "Search WordPress commit history for specific changes, bug fixes, or features.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query for commits (keywords, ticket numbers, author names, etc.)",
          },
        },
        required: ["query"],
      },
    },
  ];
}

// Call GitHub tool function
export async function callGitHubTool(
  toolName: string,
  args: any
): Promise<MCPToolResult> {
  switch (toolName) {
    case "search_wordpress_code":
      return await searchWordPressCode(args.query, args.path);
    case "get_wordpress_file":
      return await getWordPressFile(args.filePath);
    case "get_wordpress_directory":
      return await getWordPressDirectory(args.dirPath);
    case "get_wordpress_commit":
      return await getWordPressCommit(args.sha);
    case "search_wordpress_commits":
      return await searchWordPressCommits(args.query);
    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown GitHub tool: ${toolName}`,
          },
        ],
        isError: true,
      };
  }
}
