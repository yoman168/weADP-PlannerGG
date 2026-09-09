import { PROJECTS } from '@/lib/we-adk-mock/projects';
import ProjectLayout from './project-layout';

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ projectId: p.id }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProjectLayout>{children}</ProjectLayout>;
}
