import { useEffect, useRef } from 'react'
import { supabase } from '../types'

export type RealtimeTableConfig = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  /** Optional PostgREST filter, e.g. "member_id=eq.<uuid>" */
  filter?: string
}

/**
 * Live-update hook ("AJAX"): subscribes to Supabase Realtime changes for the
 * given tables and re-runs the provided refresh callback whenever relevant
 * data changes — no manual reload needed. Events are debounced so bursts of
 * inserts (e.g. a payment + its notification) trigger a single refresh.
 */
export function useRealtimeRefresh(
  enabled: boolean,
  channelKey: string,
  tables: RealtimeTableConfig[],
  onChange: () => void,
  debounceMs = 600
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const tablesKey = JSON.stringify(tables)

  useEffect(() => {
    if (!enabled || tables.length === 0) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void onChangeRef.current()
      }, debounceMs)
    }

    const channel = supabase.channel(`realtime-${channelKey}`)
    for (const t of tables) {
      channel.on(
        'postgres_changes',
        {
          event: t.event ?? '*',
          schema: 'public',
          table: t.table,
          ...(t.filter ? { filter: t.filter } : {}),
        },
        scheduleRefresh
      )
    }
    void channel.subscribe()

    // Refresh once when connectivity returns after being offline.
    const onOnline = () => scheduleRefresh()
    window.addEventListener('online', onOnline)

    return () => {
      window.removeEventListener('online', onOnline)
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelKey, tablesKey, debounceMs])
}