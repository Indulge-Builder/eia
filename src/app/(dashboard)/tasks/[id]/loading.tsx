/**
 * Route-level loading for /tasks/[id] (double-skeleton fix, 2026-07-06).
 *
 * Without this file, navigating /tasks → /tasks/[id] suspends at the PARENT
 * boundary and paints tasks/loading.tsx — the LIST-page skeleton — then swaps
 * to the page's own <WorkspaceSkeleton> once the route resolves: two
 * mismatched skeleton phases per open. Rendering the same workspace shape
 * here makes both phases visually identical, so the user sees one steady
 * skeleton until the workspace streams in.
 */

import { WorkspaceSkeleton } from './WorkspaceSkeleton';

export default function GroupTaskWorkspaceLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <WorkspaceSkeleton />
    </main>
  );
}
