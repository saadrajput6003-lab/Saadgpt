import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  // Parse markdown into formatted blocks
  return (
    <div className="markdown-content text-neutral-200 text-sm leading-relaxed space-y-3 font-normal break-words selection:bg-rose-600/30">
      {parseMarkdown(content)}
    </div>
  );
};

function parseMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      nodes.push(...renderTextParagraphs(textBefore, `pre-${lastIndex}`));
    }

    const language = match[1] || 'code';
    const codeContent = match[2];
    nodes.push(
      <CodeBlock
        key={`code-${match.index}`}
        code={codeContent}
        language={language}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  const remainingText = text.slice(lastIndex);
  if (remainingText) {
    nodes.push(...renderTextParagraphs(remainingText, `post-${lastIndex}`));
  }

  return nodes;
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-rose-950/40 bg-[#0c070a] shadow-lg">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#140b10] border-b border-rose-950/30 text-xs text-neutral-400">
        <span className="font-mono text-rose-300 font-semibold lowercase">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-rose-950/40 text-neutral-400 hover:text-white transition"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[11px]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-neutral-200">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

function renderTextParagraphs(text: string, keyPrefix: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`${keyPrefix}-ul-${elements.length}`} className="list-disc pl-5 my-2 space-y-1 text-neutral-300">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`${keyPrefix}-ol-${elements.length}`} className="list-decimal pl-5 my-2 space-y-1 text-neutral-300">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`${keyPrefix}-h4-${index}`} className="text-base font-bold text-white mt-3 mb-1">
          {renderInline(trimmed.substring(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`${keyPrefix}-h3-${index}`} className="text-lg font-bold text-white mt-4 mb-1.5 flex items-center gap-2">
          <span className="w-1.5 h-4 rounded bg-rose-500 inline-block" />
          {renderInline(trimmed.substring(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`${keyPrefix}-h2-${index}`} className="text-xl font-extrabold text-white mt-5 mb-2 pb-1 border-b border-rose-950/40">
          {renderInline(trimmed.substring(2))}
        </h2>
      );
      return;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInline(trimmed.substring(2)));
      return;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInline(numMatch[2]));
      return;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(
        <hr key={`${keyPrefix}-hr-${index}`} className="border-rose-950/40 my-3" />
      );
      return;
    }

    // Regular line / paragraph
    flushList();
    if (trimmed.length > 0) {
      elements.push(
        <p key={`${keyPrefix}-p-${index}`} className="my-1.5 text-neutral-300">
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic text-rose-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-300 font-mono text-xs border border-rose-900/30">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
