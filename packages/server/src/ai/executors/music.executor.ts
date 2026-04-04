import type { ToolResult } from '../executor.js';
import * as lidarr from '../../services/lidarr.service.js';

type Args = Record<string, unknown>;

export async function handleMusicSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '').toLowerCase();
  const artists = await lidarr.getArtists();
  const matches = artists
    .filter(a => a.artistName.toLowerCase().includes(query))
    .slice(0, 10)
    .map(a => ({
      id: a.id,
      name: a.artistName,
      status: a.status,
      albumCount: a.albumCount,
      genres: a.genres?.slice(0, 3),
    }));
  return { success: true, data: { count: matches.length, artists: matches } };
}

export async function handleMusicLookup(args: Args): Promise<ToolResult> {
  const results = await lidarr.lookup(String(args.query || ''));
  const compact = (results as Array<Record<string, unknown>>).slice(0, 5).map(a => ({
    foreignArtistId: a.foreignArtistId,
    artistName: a.artistName,
    overview: typeof a.overview === 'string' ? a.overview.slice(0, 200) : '',
    genres: a.genres,
    status: a.status,
  }));
  return { success: true, data: compact };
}

export async function handleMusicAdd(args: Args): Promise<ToolResult> {
  const foreignArtistId = String(args.foreignArtistId || '');
  if (!foreignArtistId) return { success: false, error: 'foreignArtistId ist erforderlich' };

  const lookupResults = await lidarr.lookup(`lidarr:${foreignArtistId}`) as Array<Record<string, unknown>>;
  if (!lookupResults.length) return { success: false, error: 'Künstler nicht gefunden' };

  const artist = lookupResults[0];
  const rootFolders = await lidarr.getRootFolders();
  const profiles = await lidarr.getQualityProfiles() as Array<Record<string, unknown>>;

  const result = await lidarr.addArtist({
    ...artist,
    rootFolderPath: rootFolders[0]?.path,
    qualityProfileId: profiles[0]?.id,
    metadataProfileId: 1,
    monitored: true,
    addOptions: {
      searchForMissingAlbums: args.searchNow !== false,
    },
  });

  return {
    success: true,
    data: {
      name: (result as Record<string, unknown>).artistName,
      id: (result as Record<string, unknown>).id,
      searchStarted: args.searchNow !== false,
    },
  };
}

export async function handleMusicDetails(args: Args): Promise<ToolResult> {
  const id = Number(args.id);
  if (!id) return { success: false, error: 'id ist erforderlich' };

  const [artist, albums] = await Promise.all([
    lidarr.getArtist(id),
    lidarr.getAlbumsByArtist(id),
  ]);

  return {
    success: true,
    data: {
      id: artist.id,
      name: artist.artistName,
      status: artist.status,
      genres: artist.genres,
      albumCount: artist.albumCount,
      path: artist.path,
      monitored: artist.monitored,
      albums: albums.slice(0, 20).map(a => ({
        id: a.id,
        title: a.title,
        releaseDate: a.releaseDate,
        monitored: a.monitored,
        trackFileCount: a.statistics?.trackFileCount ?? 0,
        totalTrackCount: a.statistics?.trackCount ?? 0,
      })),
    },
  };
}

export async function handleMusicTriggerSearch(args: Args): Promise<ToolResult> {
  const artistId = Number(args.artistId);
  if (!artistId) return { success: false, error: 'artistId ist erforderlich' };
  await lidarr.triggerSearch(artistId);
  return { success: true, data: { artistId, action: 'search_started' } };
}
