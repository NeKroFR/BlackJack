import type { ReactNode } from 'react'
import { Heading, Text, Stack, Inline } from '../ui'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

/** Consistent screen title block used across every route. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Inline justify="between" align="start" wrap className="mb-6 gap-4">
      <Stack gap={1}>
        <Heading level={1} className="text-2xl md:text-3xl">{title}</Heading>
        {description && (
          <Text tone="muted" className="max-w-2xl">{description}</Text>
        )}
      </Stack>
      {actions && <Inline gap={2}>{actions}</Inline>}
    </Inline>
  )
}

export interface ComingSoonProps {
  title: string
  description: ReactNode
  points?: string[]
}

/** Structured placeholder for screens filled in by a later workflow. */
export function ComingSoon({ title, description, points }: ComingSoonProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {points && points.length > 0 && (
        <ul className="space-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <Text tone="muted">{p}</Text>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
