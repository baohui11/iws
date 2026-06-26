'use client'

export function PreviewText({ text }: { text: string }) {
  return (
    <pre className="min-h-0 flex-1 overflow-auto bg-content1 p-5 text-left text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
      {text}
    </pre>
  )
}
