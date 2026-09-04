import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchOdesli } from './odesli'

const makePageHtml = (pageData: unknown) => {
  const data = { props: { pageProps: { pageData } } }
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`
}

const makeNotFoundHtml = () =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ page: '/not-found', props: { pageProps: {} } })}</script>`

describe('fetchOdesli', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('parses matched track data from the scraped page', async () => {
    const html = makePageHtml({
      entityUniqueId: 'spotify|song|abc123',
      pageUrl: 'https://song.link/s/abc123',
      entityData: { title: 'Song Title', artistName: 'Artist Name', thumbnailUrl: 'https://img/thumb.jpg' },
      sections: [
        { links: [
          { platform: 'spotify', url: 'https://open.spotify.com/track/abc123' },
          { platform: 'deezer', url: 'https://www.deezer.com/track/999' },
          { platform: 'appleMusic' }, // unmatched platform: no url, should be skipped
        ] },
      ],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => html }))

    const result = await fetchOdesli('https://open.spotify.com/track/abc123')

    expect(result).toEqual({
      entityUniqueId: 'spotify|song|abc123',
      pageUrl: 'https://song.link/s/abc123',
      linksByPlatform: {
        spotify: { url: 'https://open.spotify.com/track/abc123' },
        deezer: { url: 'https://www.deezer.com/track/999' },
      },
      entitiesByUniqueId: {
        'spotify|song|abc123': { title: 'Song Title', artistName: 'Artist Name', thumbnailUrl: 'https://img/thumb.jpg' },
      },
    })
  })

  it('returns null when song.link serves its not-found page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => makeNotFoundHtml() }))
    const result = await fetchOdesli('https://open.spotify.com/track/doesnotexist')
    expect(result).toBeNull()
  })

  it('throws on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() }))
    await expect(fetchOdesli('https://open.spotify.com/track/abc123')).rejects.toThrow('Odesli 503')
  })

  it('throws when __NEXT_DATA__ is missing from the page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => '<html>no data</html>' }))
    await expect(fetchOdesli('https://open.spotify.com/track/abc123')).rejects.toThrow('Could not parse song.link page')
  })

  it('retries after a 429 with Retry-After when waitOnRateLimit is set', async () => {
    vi.useFakeTimers()
    const html = makePageHtml({
      entityUniqueId: 'spotify|song|abc123',
      pageUrl: 'https://song.link/s/abc123',
      entityData: { title: 'Song Title', artistName: 'Artist Name' },
      sections: [],
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'retry-after': '1' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () => html })
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchOdesli('https://open.spotify.com/track/abc123', undefined, { waitOnRateLimit: true, maxWaitCycles: 1 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result?.entityUniqueId).toBe('spotify|song|abc123')
    vi.useRealTimers()
  })
})
