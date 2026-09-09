/**
 * Screens waiting for a round — the Request tab.
 *
 * A request keeps the place in the IA it was agreed at as a path rather than a parent id,
 * because that parent may not exist in the product yet. That is the point of the tab:
 * these screens arrive ahead of the rounds.
 *
 * Moving screens in is one call with the whole set, not one call per screen, because a
 * screen whose name already waits from the same source replaces that row rather than
 * joining it — and deciding that per screen across several requests would let a partial
 * failure leave duplicates behind.
 */
import { api, unwrap, type Schema } from './client';

export type RequestView = Schema<'RequestView'>;
export type RequestCreate = Schema<'RequestCreate'>;
export type Placement = Schema<'Placement'>;

/** Every request for a product; `waitingOnly` narrows it to the ones not yet in a round. */
export async function listRequests(
  projectId: string,
  waitingOnly?: boolean,
): Promise<RequestView[]> {
  return (
    (await unwrap(
      api.GET('/api/projects/{projectId}/requests', {
        params: {
          path: { projectId },
          query: waitingOnly === undefined ? {} : { waitingOnly },
        },
      }),
    )) ?? []
  );
}

/** Moves a set of screens into a product, and hands back the rows they became. */
export async function moveScreensIn(
  projectId: string,
  screens: RequestCreate[],
): Promise<RequestView[]> {
  return (
    (await unwrap(
      api.POST('/api/projects/{projectId}/requests', {
        params: { path: { projectId } },
        body: { screens },
      }),
    )) ?? []
  );
}

/** Files one waiting request into a round. */
export async function fileIntoRound(id: string, version: number): Promise<RequestView> {
  return unwrap(
    api.POST('/api/requests/{id}/file', { params: { path: { id } }, body: { version } }),
  );
}

export async function deleteRequest(id: string): Promise<void> {
  await unwrap(api.DELETE('/api/requests/{id}', { params: { path: { id } } }));
}
