import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CheckIcon, GlobeIcon, ShieldIcon } from './Icons'
import { useDestinationPicker } from '../hooks/useDestinationPicker'
import type { CaptureTarget, DestinationOrganization } from '@/types/destinations.types'

interface Choice {
  key: string
  label: string
  sublabel?: string
  target: CaptureTarget
  type: 'personal' | 'organization' | 'workspace'
  orgId?: string
}

function buildChoices(
  destinations: ReturnType<typeof useDestinationPicker>['destinations']
): Choice[] {
  const out: Choice[] = [
    {
      key: 'personal',
      label: 'Personal',
      sublabel: 'Saved to your private vault',
      target: { organizationId: null, workspaceId: null },
      type: 'personal',
    },
  ]
  if (!destinations) return out
  for (const org of destinations.organizations) {
    out.push({
      key: `org:${org.id}`,
      label: org.name,
      sublabel: 'Organization root',
      target: { organizationId: org.id, workspaceId: null },
      type: 'organization',
      orgId: org.id,
    })
    for (const ws of org.workspaces) {
      out.push({
        key: `ws:${org.id}:${ws.id}`,
        label: `${org.name} / ${ws.name}`,
        sublabel: `Workspace · ${org.name}`,
        target: { organizationId: org.id, workspaceId: ws.id },
        type: 'workspace',
        orgId: org.id,
      })
    }
  }
  return out
}

function targetsEqual(a: CaptureTarget, b: CaptureTarget): boolean {
  return a.organizationId === b.organizationId && a.workspaceId === b.workspaceId
}

function activeLabel(
  effective: CaptureTarget,
  destinations: ReturnType<typeof useDestinationPicker>['destinations']
): string {
  if (!effective.organizationId) return 'Personal'
  if (!destinations) return 'Custom'
  const org: DestinationOrganization | undefined = destinations.organizations.find(
    o => o.id === effective.organizationId
  )
  if (!org) return 'Custom'
  if (!effective.workspaceId) return org.name
  const ws = org.workspaces.find(w => w.id === effective.workspaceId)
  return ws ? `${org.name} / ${ws.name}` : org.name
}

export const DestinationPicker: React.FC = () => {
  const {
    destinations,
    effectiveTarget,
    syncDefault,
    isLoading,
    loadError,
    selectOnce,
    selectAsDefault,
  } = useDestinationPicker()

  const choices = useMemo(() => buildChoices(destinations), [destinations])
  const activeKey = useMemo(() => {
    const match = choices.find(c => targetsEqual(c.target, effectiveTarget))
    return match?.key ?? 'personal'
  }, [choices, effectiveTarget])

  const headline = activeLabel(effectiveTarget, destinations)

  return (
    <section className="rounded-lg border border-border bg-card" aria-label="Capture destination">
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Destination
        </h3>
        {loadError && (
          <span
            className="font-mono text-[10px] uppercase tracking-wider text-warning"
            title={loadError}
          >
            offline · personal only
          </span>
        )}
      </header>
      <div className="px-4 pt-1 pb-2">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>Captures will save to:</span>
          <span className="text-[12px] font-medium text-foreground" data-testid="active-label">
            {headline}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-border" role="listbox" aria-label="Destination choices">
        {isLoading && <li className="px-4 py-2 text-[12px] text-muted-foreground">Loading...</li>}
        {!isLoading &&
          choices.map(choice => {
            const isActive = choice.key === activeKey
            const isDefault = targetsEqual(choice.target, syncDefault)
            return (
              <li key={choice.key} role="option" aria-selected={isActive}>
                <div
                  className={cn(
                    'flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-accent/40',
                    isActive && 'bg-accent/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectOnce(choice.target)}
                    className="flex flex-1 items-start gap-2.5 text-left"
                    aria-label={`Use ${choice.label} for the next capture`}
                    data-testid={`pick-${choice.key}`}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-foreground',
                        choice.type === 'personal' && 'text-primary'
                      )}
                    >
                      {choice.type === 'personal' ? (
                        <ShieldIcon size={11} />
                      ) : (
                        <GlobeIcon size={11} />
                      )}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {choice.label}
                      </span>
                      {choice.sublabel && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {choice.sublabel}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <span className="ml-auto inline-flex items-center text-success">
                        <CheckIcon size={13} />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAsDefault(choice.target)}
                    disabled={isDefault}
                    className={cn(
                      'shrink-0 self-center rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider',
                      isDefault
                        ? 'text-muted-foreground cursor-default'
                        : 'text-foreground hover:bg-accent'
                    )}
                    aria-label={`Make ${choice.label} the default destination`}
                    data-testid={`default-${choice.key}`}
                  >
                    {isDefault ? 'Default' : 'Make default'}
                  </button>
                </div>
              </li>
            )
          })}
      </ul>
    </section>
  )
}
