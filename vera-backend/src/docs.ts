import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { DocChunk } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedDocs: DocChunk[] | null = null;

const DEFAULT_DOCS_DIR = path.resolve(__dirname, "../../frontend/public/docs");

function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function walkDir(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function loadDocsIndex(): Promise<DocChunk[]> {
  if (cachedDocs) return cachedDocs;

  const docsRoot = process.env.REPUTATION_DAO_DOCS_DIR
    ? path.resolve(process.env.REPUTATION_DAO_DOCS_DIR)
    : DEFAULT_DOCS_DIR;

  const files = await walkDir(docsRoot);

  const docs: DocChunk[] = [];

  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const relPath = path.relative(docsRoot, filePath).replace(/\\/g, "/");
      const firstHeadingMatch = content.match(/^#\s+(.+)$/m);
      const title = firstHeadingMatch ? firstHeadingMatch[1].trim() : relPath;
      const basePath = `/docs/${relPath}`;

      docs.push({
        id: relPath,
        path: basePath,
        title,
        content,
      });

      // Additionally, index individual sections based on markdown headings so
      // Vera can retrieve and cite more focused chunks like /docs/file.md#section.
      const headingRegex = /^#{1,6}\s+(.+)$/gm;
      const matches = Array.from(content.matchAll(headingRegex));

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const headingText = match[1].trim();
        const startIndex = match.index ?? 0;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index ?? content.length : content.length;
        const sectionContent = content.slice(startIndex, endIndex).trim();
        const slug = slugifyHeading(headingText);

        if (!sectionContent) continue;

        docs.push({
          id: `${relPath}#${slug}`,
          path: `${basePath}#${slug}`,
          title: headingText,
          content: sectionContent,
        });
      }
    } catch (err) {
      console.error("Failed to read doc file", filePath, err);
    }
  }

  cachedDocs = docs;
  return docs;
}

export async function searchDocs(query: string, maxResults = 4): Promise<DocChunk[]> {
  const docs = await loadDocsIndex();
  const q = query.toLowerCase();

  const scored = docs
    .map((doc) => {
      const text = doc.content.toLowerCase();
      let score = 0;

      // Simple heuristic: count occurrences of keywords and headings.
      const occurrences = q ? text.split(q).length - 1 : 0;
      score += occurrences * 5;

      if (q && doc.title.toLowerCase().includes(q)) score += 20;

      // Prefer shorter docs slightly to keep answers focused.
      const lengthPenalty = Math.min(doc.content.length / 5000, 1);
      score -= lengthPenalty * 5;

      return { doc, score };
    })
    .sort((a, b) => b.score - a.score);

  // Prefer positively scored matches, but if nothing scores above 0,
  // fall back to the top maxResults docs so we can still surface
  // some sources to the UI.
  const positive = scored.filter((s) => s.score > 0).slice(0, maxResults);
  const chosen = (positive.length > 0 ? positive : scored.slice(0, maxResults)).map(
    (s) => s.doc,
  );

  return chosen;
}
