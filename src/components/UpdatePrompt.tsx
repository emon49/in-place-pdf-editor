import { useRegisterSW } from 'virtual:pwa-register/react';
import { Banner } from './Banner';

/** "Reload to update" notice (app-shell spec): a new version is applied only when the user agrees. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <Banner
      tone="info"
      onDismiss={() => setNeedRefresh(false)}
      action={
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Reload to update
        </button>
      }
    >
      A new version of the editor is available.
    </Banner>
  );
}
