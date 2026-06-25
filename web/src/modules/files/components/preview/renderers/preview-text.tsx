'use client'

export function PreviewText({ text }: { text: string }) {
  return (
    <pre className="max-h-[min(70vh,720px)] overflow-auto rounded-lg border border-default-200 bg-default-50 p-4 text-left text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground dark:bg-default-100/20">
      {text}
    </pre>
  )
}
