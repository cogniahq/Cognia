import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface OrganizationSummaryMarkdownProps {
  markdown: string
}

export function OrganizationSummaryMarkdown({
  markdown,
}: OrganizationSummaryMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 text-base font-semibold text-gray-900">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-900">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-relaxed text-gray-700 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-2 pl-5 text-sm text-gray-700 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm text-gray-700 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="pl-1 leading-relaxed">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700">{children}</em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-gray-300 pl-4 text-sm text-gray-600 last:mb-0">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 last:mb-0">
            {children}
          </pre>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
          >
            {children}
          </a>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}
