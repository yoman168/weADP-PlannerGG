import { redirect } from 'next/navigation';

/**
 * A project has no overview screen — opening one goes straight to Business,
 * where its versions and design files live. The route is kept so a bare project
 * link still lands somewhere useful.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/we-adk/projects/${projectId}/sketcher`);
}
