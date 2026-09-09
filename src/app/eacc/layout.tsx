'use client';

import { type ReactNode } from 'react';
import { PropertiesPanel } from '@/components/eacc/editable-section';
import { EditProvider, useEdit } from '@/components/eacc/edit-context';
import { EaccHeader, EaccSidebar } from '@/components/eacc/shell';
import { WorkspaceProvider } from '@/lib/api/workspace-provider';

function EaccShell({ children }: { children: ReactNode }) {
  const { editMode, setSelectedId } = useEdit();

  return (
    <div className="flex h-dvh flex-col">
      <EaccHeader />
      <div className="flex min-h-0 flex-1">
        <EaccSidebar />
        <main
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950"
          onClick={() => editMode && setSelectedId(null)}
        >
          {children}
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}

export default function EaccLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <EditProvider>
        <EaccShell>{children}</EaccShell>
      </EditProvider>
    </WorkspaceProvider>
  );
}
