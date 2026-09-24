import type { ReactNode } from 'react'

export const Chevron = ({ dir = 'right' }: { dir?: 'right' | 'left' }) => (
  <svg width="12" height="12" aria-hidden="true">
    <path d={dir === 'right' ? 'M4 2 L8 6 L4 10' : 'M8 2 L4 6 L8 10'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const Warn = () => (
  <svg width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M8 1.8 L15 14 H1 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8 6.2 V9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="11.9" r="0.9" fill="currentColor" />
  </svg>
)

export function Loading({ height = 320 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-label="Loading" />
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="error-box">{error instanceof Error ? error.message : 'Something went wrong.'}</div>
}

export function Header({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="kicker">{kicker}</div>
      <h2 className="h2">{title}</h2>
      {children}
    </div>
  )
}
