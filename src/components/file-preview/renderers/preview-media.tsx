'use client'

export function PreviewMedia({
  signedUrl,
  media,
}: {
  signedUrl: string
  media: 'video' | 'audio'
}) {
  if (media === 'video') {
    return (
      <video
        controls
        controlsList="nodownload"
        className="mx-auto max-h-[min(75vh,800px)] max-w-full rounded-lg bg-black"
        src={signedUrl}
        preload="metadata"
      />
    )
  }
  return (
    <audio
      controls
      controlsList="nodownload"
      className="mx-auto w-full max-w-2xl"
      src={signedUrl}
      preload="metadata"
    />
  )
}
