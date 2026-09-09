/**
 * Meetings and the screens they produced.
 *
 * The screens come back without their html: a meeting's pages together run to megabytes,
 * so a list is a list of names and placements and the page itself is fetched per screen.
 * That is `screenHtml` below, and it is why the Drafts tree can render a whole product's
 * IA without downloading it.
 */
import { api, unwrap, type Schema } from './client';

export type MeetingView = Schema<'MeetingView'>;
export type MeetingCreate = Schema<'MeetingCreate'>;
export type MeetingUpdate = Schema<'MeetingUpdate'>;
export type ScreenView = Schema<'ScreenView'>;
export type ScreenWrite = Schema<'ScreenWrite'>;

export async function listMeetings(projectId: string): Promise<MeetingView[]> {
  return (
    (await unwrap(
      api.GET('/api/projects/{projectId}/meetings', { params: { path: { projectId } } }),
    )) ?? []
  );
}

export async function createMeeting(projectId: string, body: MeetingCreate): Promise<MeetingView> {
  return unwrap(
    api.POST('/api/projects/{projectId}/meetings', { params: { path: { projectId } }, body }),
  );
}

export async function getMeeting(id: string): Promise<MeetingView> {
  return unwrap(api.GET('/api/meetings/{id}', { params: { path: { id } } }));
}

export async function updateMeeting(id: string, body: MeetingUpdate): Promise<MeetingView> {
  return unwrap(api.PATCH('/api/meetings/{id}', { params: { path: { id } }, body }));
}

export async function deleteMeeting(id: string): Promise<void> {
  await unwrap(api.DELETE('/api/meetings/{id}', { params: { path: { id } } }));
}

/**
 * Replaces the screen set after a generation.
 *
 * Screens matched by name keep their id, their placement in the IA and their moved mark,
 * so regenerating a meeting does not lose where its screens were agreed to sit.
 */
export async function replaceScreens(id: string, screens: ScreenWrite[]): Promise<MeetingView> {
  return unwrap(
    api.PUT('/api/meetings/{id}/screens', { params: { path: { id } }, body: { screens } }),
  );
}

/** Resets the set: the screens go, the notes stay. */
export async function resetScreens(id: string): Promise<MeetingView> {
  return unwrap(api.DELETE('/api/meetings/{id}/screens', { params: { path: { id } } }));
}

/** Records that the whole set has been sent to a product. */
export async function markMoved(id: string, projectId: string): Promise<MeetingView> {
  return unwrap(
    api.POST('/api/meetings/{id}/screens/moved', { params: { path: { id } }, body: { projectId } }),
  );
}

/** One screen's page. Fetched on its own, because a set of them is megabytes. */
export async function screenHtml(id: string): Promise<string> {
  const result = await unwrap(api.GET('/api/screens/{id}/html', { params: { path: { id } } }));
  return result.html ?? '';
}

export async function saveScreenHtml(id: string, html: string): Promise<void> {
  await unwrap(api.PUT('/api/screens/{id}/html', { params: { path: { id } }, body: { html } }));
}
