import { redirect } from 'next/navigation';

/** The entry point is the project list, exactly as in the full monorepo build. */
export default function HomePage(): never {
  redirect('/we-adk');
}
