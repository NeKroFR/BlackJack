import { Stack, Text } from '../../ui'
import type { LessonBlock } from './lessons'

function Table({ head, rows, caption }: { head: string[]; rows: string[][]; caption?: string }) {
  return (
    <Stack gap={2}>
      {caption && (
        <Text size="xs" tone="muted" weight="medium">
          {caption}
        </Text>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {head.map((h) => (
                <th key={h} className="py-2 pr-4 font-semibold text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={j === 0 ? 'py-2 pr-4 font-medium' : 'py-2 pr-4 text-ink-muted'}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}

/** Renders a lesson's teaching blocks: prose, lists, tables and callouts. */
export function LessonContent({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <Stack gap={4}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'p':
            return (
              <Text key={i} className="leading-relaxed">
                {block.text}
              </Text>
            )
          case 'list':
            return (
              <ul key={i} className="space-y-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                    />
                    <Text tone="muted" className="leading-relaxed">
                      {item}
                    </Text>
                  </li>
                ))}
              </ul>
            )
          case 'table':
            return <Table key={i} head={block.head} rows={block.rows} caption={block.caption} />
          case 'note':
            return (
              <div
                key={i}
                className="rounded-xl border-l-2 border-accent bg-surface-2 px-4 py-3"
              >
                <Text size="sm" className="leading-relaxed">
                  {block.text}
                </Text>
              </div>
            )
        }
      })}
    </Stack>
  )
}
