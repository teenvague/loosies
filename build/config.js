// Everything about this site that is a decision rather than machinery.
export const CHANNEL = 'teenvague-loosies';

// Are.na's v2 API is being retired; v3 wants a bearer token even for
// channels you own. Make one at are.na → Settings → Applications
// (personal access token) and put it in the ARENA_TOKEN environment
// variable locally, or a repository secret of the same name on GitHub.
export const API = 'https://api.are.na/v3';

// Newest connection first, the way the channel reads on Are.na.
export const NEWEST_FIRST = true;

// Images are copied into the repo rather than hotlinked: the channel is
// private, and a public page cannot depend on Are.na serving it.
export const MIRROR_SIZES = ['medium', 'large'];

// Keep the page out of search results. Flip to true when it should be findable.
export const INDEXABLE = false;

export const SITE_TITLE = 'TEENVAGUE — Loosies';
