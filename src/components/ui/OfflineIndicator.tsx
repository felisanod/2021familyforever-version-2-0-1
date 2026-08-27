import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/** Shows a persistent banner while the device is offline. */
export default function OfflineIndicator() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[95] bg-warning text-white text-center text-xs sm:text-sm font-medium py-1.5 px-4" role="alert">
      Haupo mtandaoni — baadhi ya taarifa hazitapatika hadi muunganisho wako urejee.
    </div>
  )
}