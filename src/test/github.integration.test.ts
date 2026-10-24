// Exercises the real GitHub API. Skipped unless both env vars are set:
//   DISHDEX_IT_REPO=owner/repo GH_TOKEN=... npx vitest run github.integration
import { describe, expect, it } from 'vitest'
import { textToB64, bytesToB64 } from '../lib/b64'
import { GitHubRemote, isConflict } from '../lib/remote'

const env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {}
const repo = env.DISHDEX_IT_REPO
const token = env.GH_TOKEN

describe.skipIf(!repo || !token)('GitHubRemote against a real repo', () => {
  it('round-trips files, detects stale writes, and cleans up', async () => {
    const r = new GitHubRemote({ repo: repo!, token: token!, branch: 'main' })
    const info = await r.verify()
    expect(info.fullName.toLowerCase()).toBe(repo!.toLowerCase())

    const tag = Math.random().toString(36).slice(2, 8)
    const path = `selftest/it-${tag}.json`
    const photo = `selftest/it-${tag}.jpg`

    const sha1 = await r.put(path, textToB64('{"v":1}\n'), 'selftest: create')
    const got = await r.get(path)
    expect(got).toEqual({ sha: sha1, text: '{"v":1}\n' })

    let conflict: unknown = null
    try {
      await r.put(path, textToB64('{"v":2}\n'), 'selftest: stale', 'a'.repeat(40))
    } catch (e) {
      conflict = e
    }
    expect(isConflict(conflict)).toBe(true)

    const sha2 = await r.put(path, textToB64('{"v":3}\n'), 'selftest: update', sha1)
    const bytes = new Uint8Array(4096).map((_, i) => (i * 37) & 255)
    const photoSha = await r.put(photo, bytesToB64(bytes), 'selftest: photo')

    const head = await r.head()
    expect(await r.head()).toBe(head) // second call is a free 304
    const tree = await r.tree(head!)
    const many = await r.readMany([[path, sha2]])
    expect(many.get(sha2)).toBe('{"v":3}\n')
    expect(tree.get(path)).toBe(sha2)
    expect(tree.get(photo)).toBe(photoSha)
    expect(await r.readText(path, sha2)).toBe('{"v":3}\n')
    expect(new Uint8Array(await (await r.readBinary(photo)).arrayBuffer())).toEqual(bytes)

    await r.remove(path, sha2, 'selftest: clean up')
    await r.remove(photo, photoSha, 'selftest: clean up')
    expect(await r.get(path)).toBeNull()
  }, 60_000)
})
