import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadDocsIndex, searchDocs } from './docs.js';
import type { ChatRequestBody, ChatResponseBody, VeraMessage } from './types.js';

const PORT = Number(process.env.PORT || 4000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function containsSensitiveKeyMaterial(text: string): boolean {
  const lowered = text.toLowerCase();
  if (/(seed phrase|recovery phrase|mnemonic|private key|secret key)/.test(lowered)) {
    return true;
  }
  const words = lowered.split(/\s+/).filter(Boolean);
  if (words.length >= 12 && words.length <= 36) {
    const markers = ['seed', 'phrase', 'recovery', 'wallet', 'private', 'mnemonic'];
    if (markers.some((w) => words.includes(w))) {
      return true;
    }
  }
  return false;
}

function summarizeConversation(messages: VeraMessage[]): string {
  const recent = messages.slice(-8);
  return recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
}

function buildSuggestions(mode: ChatRequestBody['mode'] | undefined): string[] {
  switch (mode) {
    case 'docs_qa':
      return [
        'Show me the Getting Started steps in simpler terms.',
        'Where can I find the deployment guide?',
        'Explain the core concepts behind Reputation DAO.',
      ];
    case 'guidance':
      return [
        'Walk me through linking my wallet safely.',
        'Guide me to my first reputation award step by step.',
        'Show me how to navigate from the dashboard to docs.',
      ];
    case 'troubleshoot':
      return [
        'Help me debug a wallet connection error.',
        'What should I check if the frontend cannot reach the canisters?',
        'How do I fix DFX version or port conflicts?',
      ];
    case 'support':
      return [
        'Summarize my issue so far.',
        'What details should I capture for follow-up?',
        'What can I try while I wait for help?',
      ];
    case 'explain':
    default:
      return [
        'Explain how soulbound reputation differs from tokens.',
        'How does the ckBTC treasury reward reputation without changing it?',
        'What are micro-tips and scheduled payouts in this system?',
      ];
  }
}

function buildPrompt(input: {
  messages: VeraMessage[];
  mode?: ChatRequestBody['mode'];
  page?: string;
  docs: { title: string; path: string; content: string }[];
}): string {
  const { messages, mode, page, docs } = input;
  const conversation = summarizeConversation(messages);

  const docSnippets = docs
    .map((d) => {
      const snippet = d.content.slice(0, 3000);
      return `# ${d.title}\n\nSource: ${d.path}\n\n${snippet}`;
    })
    .join('\n\n---\n\n');

  const parts: string[] = [];

  parts.push(
    'You are Vera, an AI guide for Reputation DAO.\n' +
      '\n' +
      'Reputation DAO is a soulbound reputation protocol on the Internet Computer (ICP), with a Bitcoin-backed ckBTC economy layer.\n' +
      '\n' +
      'Hard rules you must always follow:\n' +
      '- Reputation is soulbound and cannot be sold, traded or transferred.\n' +
      '- Money (ckBTC, BTC, ICP or any token) never directly changes a user\'s reputation score.\n' +
      '- You are read-only: you never send transactions, never mutate on-chain state, and never claim to perform actions for the user.\n' +
      '- You never ask for, store or process seed phrases, recovery phrases, mnemonics or private keys. If the user offers such secrets, you warn them and refuse to use the data.\n' +
      '- You warn users about risky behavior (sharing keys, signing unknown transactions, etc.).'
  );

  if (mode) {
    parts.push(`User intent/mode: ${mode}.`);
  }

  if (page) {
    parts.push(
      'The user is currently on or asking about this part of the app: ' +
        page +
        '. Explain step-by-step, beginner-friendly navigation such as "Go to Wallets -> Link, then tap Sign".'
    );
  }

  if (docs.length) {
    parts.push(
      'Use the following documentation excerpts as the main source of truth. ' +
        'When you rely on them, mention a short citation like "source: ' +
        docs.map((d) => d.path).join(', ') +
        '".'
    );
    parts.push('=== Documentation excerpts ===\n' + docSnippets);
  }

  parts.push('=== Conversation (most recent messages) ===\n' + conversation);
  parts.push('Now answer the user in a single, clear message. Be concise, friendly and beginner-friendly.');

  return parts.join('\n\n');
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vera-backend' });
});

app.post('/api/vera/chat', async (req, res) => {
  const body = req.body as ChatRequestBody | undefined;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const { messages, mode, page } = body;
  const latest = messages[messages.length - 1];

  if (latest && latest.role === 'user' && containsSensitiveKeyMaterial(latest.content)) {
    const safeReply: ChatResponseBody = {
      answer:
        'For your safety, never share seed phrases, recovery phrases or private keys here or anywhere online. ' +
        'Keep them offline and only use them in trusted wallet software. I can still help explain flows without ever seeing your secrets.',
      suggestions: buildSuggestions(mode),
    };
    return res.status(200).json(safeReply);
  }

  if (!GEMINI_API_KEY) {
    const msg: ChatResponseBody = {
      answer:
        'Vera is not fully configured yet: the backend is missing its GEMINI_API_KEY. ' +
        'Ask your admin to set GEMINI_API_KEY in the vera-backend environment.',
      suggestions: buildSuggestions(mode),
    };
    return res.status(500).json(msg);
  }

  try {
    await loadDocsIndex();
    const query = latest?.content || '';
    const docs = query ? await searchDocs(query, 4) : [];

    const prompt = buildPrompt({ messages, mode, page, docs });

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let ticketId: string | undefined;
    if (mode === 'support') {
      const now = new Date();
      ticketId = `VRT-${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now
        .getTime()
        .toString()
        .slice(-5)}`;
    }

    // Start with generic, mode-based suggestions as a fallback.
    let suggestions = buildSuggestions(mode);

    // Try to generate more contextual follow-up questions using the
    // same model, based on the latest query and this answer.
    try {
      const followupPrompt = [
        'You are Vera, an AI guide for Reputation DAO.',
        'The user just asked the question below, and you already answered it.',
        'Based on this conversation, propose 3 short, natural follow-up questions the user might ask next.',
        'Each question should be on its own line, with no numbering, no bullet characters, and no extra commentary.',
        '',
        `User question: "${query}"`,
        '',
        'Your answer:',
        text,
      ].join('\n');

      const followupResult = await model.generateContent(followupPrompt);
      const raw = followupResult.response.text();

      const dynamic = raw
        .split('\n')
        .map((line) => line.replace(/^[-*\d.\)]+\s*/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 3);

      if (dynamic.length) {
        suggestions = dynamic;
      }
    } catch (err) {
      console.warn('[Vera] Failed to generate dynamic suggestions, using defaults.', err);
    }

    const responseBody: ChatResponseBody = {
      answer: text,
      sources: docs.map((d) => d.path),
      ticketId,
      suggestions,
    };

    return res.status(200).json(responseBody);
  } catch (err) {
    console.error('[Vera] Error in /api/vera/chat', err);
    return res.status(500).json({ error: 'Internal error in Vera backend' });
  }
});

app.listen(PORT, () => {
  console.log(`[Vera] Backend listening on port ${PORT}`);
});
