'use client'

import rehypeSanitize from 'rehype-sanitize'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function PreviewMarkdown({ text }: { text: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-content1 p-6 text-left text-sm leading-relaxed">
      <article className="markdown-preview max-w-none space-y-3 [&_blockquote]:border-l-4 [&_blockquote]:border-default-300 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-default-100 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-default-100 [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-default-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-default-200 [&_th]:px-2 [&_th]:py-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {text}
        </ReactMarkdown>
      </article>
    </div>
  )
}
