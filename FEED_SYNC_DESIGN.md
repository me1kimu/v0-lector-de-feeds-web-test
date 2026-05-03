# RSS Feed Synchronization System

## Overview

This document describes the robust RSS feed synchronization mechanism implemented in the FeedReader application. The system ensures accurate data storage, deduplication, error handling, and client-side synchronization.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Feed API Routes                          │
│  /api/feeds/{type}  (RSS, Mastodon, YouTube, etc.)         │
└────────────┬────────────────────────────────────────────────┘
             │ Fetches items from source
             ↓
┌─────────────────────────────────────────────────────────────┐
│                  Feed Sync Endpoint                         │
│       /api/feeds/sync - Central sync handler               │
└────────────┬────────────────────────────────────────────────┘
             │ Deduplicates & stores items
             ↓
┌─────────────────────────────────────────────────────────────┐
│              Feed Sync Service                             │
│    lib/feed-sync.ts - Core sync logic                      │
└────────────┬────────────────────────────────────────────────┘
             │ Writes to database
             ↓
┌─────────────────────────────────────────────────────────────┐
│            Database (Supabase PostgreSQL)                  │
│  - feed_items (persistent item storage)                    │
│  - feed_sync_logs (sync history & error tracking)          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User requests refresh → refreshSource() in store
2. Fetch from source API → /api/feeds/{type}
3. Sync items → /api/feeds/sync
4. Deduplicate & validate → feed-sync.ts
5. Store in database → feed_items, feed_sync_logs
6. Update UI → Store state → Components
```

---

## Database Schema

### `feed_items` Table

Stores all individual feed items with deduplication support.

**Columns:**
- `id` - Primary key (UUID)
- `user_id` - Owner (references auth.users)
- `source_id` - Source reference (references user_sources)
- `external_id` - Source's unique identifier (for deduplication)
- `title`, `content`, `content_html` - Item content
- `source_type`, `source_name` - Source metadata
- `author_name`, `author_url` - Author information
- `item_url` - Link to original item
- `media_urls` - Array of associated media URLs
- `published_at` - Publication timestamp
- `sync_hash` - SHA256 hash of content (for detecting updates)
- `last_synced_at` - Last sync timestamp
- `created_at`, `updated_at` - Record timestamps

**Indexes:**
- `(source_id, external_id)` - UNIQUE for deduplication per source
- `(user_id, published_at DESC)` - Fast user feed queries
- `(published_at DESC)` - Chronological ordering
- `(source_type)` - Filter by source type

### `feed_sync_logs` Table

Tracks synchronization history, errors, and metrics.

**Columns:**
- `id` - Primary key (UUID)
- `user_id`, `source_id` - References
- `status` - 'success' | 'partial' | 'error' | 'timeout'
- `items_fetched`, `items_added`, `items_updated`, `items_skipped` - Metrics
- `error_message`, `error_code` - Error details
- `started_at`, `completed_at` - Timing
- `metadata` - JSON for extensibility

---

## Deduplication Strategy

### External ID Generation

Items are deduplicated per source using a 3-level fallback:

```typescript
1. Use feed's provided ID (guid, video_id, etc.)
2. Fall back to item URL (if unique)
3. Hash of title + publish date (last resort)
```

### Content Hash

A SHA256 hash of title + content + HTML is computed to detect updates:

```typescript
const syncHash = SHA256(JSON.stringify({
  title: item.title,
  content: item.content,
  contentHtml: item.contentHtml
}))
```

### Update Detection

When an external ID is found:
- **Same hash** → Item skipped (no changes)
- **Different hash** → Item updated in database
- **New external ID** → Item inserted

---

## Error Handling

### Per-Item Error Tolerance

The sync process continues even if individual items fail:

```
items_to_sync: 50
├── items[0-45]: Success ✓
├── items[46]: Parse error → logged, skipped
├── items[47]: Invalid format → logged, skipped
├── items[48-49]: Success ✓
└── Result: 48 added, 2 errors, status = "partial"
```

### Error Logging

All errors are recorded in `feed_sync_logs.metadata`:

```json
{
  "duration_ms": 2345,
  "error_count": 2,
  "errors": [
    {
      "message": "Failed to process item 'Title': Invalid date format",
      "code": "ITEM_PROCESS_ERROR",
      "itemIndex": 46
    }
  ]
}
```

### Retry Strategy

The client store automatically retries failed refreshes with:
- **Max retries**: 3 (configurable)
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 30 seconds per request
- **User notification**: Error notification shown for failed sources

---

## Sync Service API

### `syncFeedItems(items, options)`

Main synchronization function.

**Parameters:**
```typescript
items: FeedItem[]
options: {
  sourceId: string        // Required
  maxRetries?: number     // Default: 3
  timeoutMs?: number      // Default: 30000
  updateExisting?: boolean // Default: true
}
```

**Returns:**
```typescript
{
  success: boolean
  itemsFetched: number
  itemsAdded: number
  itemsUpdated: number
  itemsSkipped: number
  errors: Array<{message, code}>
  syncDuration: number (ms)
  logId: string (UUID)
}
```

### `getFeedItems(userId, options?)`

Retrieve stored items from database.

**Options:**
```typescript
{
  sourceId?: string       // Filter by source
  sourceType?: string     // Filter by type (rss, youtube, etc.)
  limit?: number          // Default: 50
  offset?: number
  since?: number          // Unix timestamp
}
```

### `getSyncHistory(sourceId, limit?)`

Get sync logs for debugging and metrics.

**Returns:** Array of sync log entries sorted by recency.

### `cleanupOldItems(userId, olderThanDays?)`

Remove items older than specified days (default: 30).

---

## Client Integration

### Store Synchronization

The Zustand store now syncs with the database:

```typescript
refreshSource: async (sourceId) => {
  // 1. Fetch items from API
  const response = await fetch(`/api/feeds/${type}`, { ... })
  const items = response.items
  
  // 2. Sync to database (deduplication, hashing, etc.)
  const syncResult = await fetch('/api/feeds/sync', {
    body: JSON.stringify({ source, items, updateExisting: true })
  })
  
  // 3. Update local state
  await addItems(items)
  await updateSource(sourceId, { lastFetched: Date.now() })
}
```

### Automatic Sync Hook

Use `useFeedSync()` hook for automatic background synchronization:

```typescript
import { useFeedSync } from '@/hooks/use-feed-sync'

function MyComponent() {
  const { isSyncing, lastSyncTime, syncErrors, syncNow } = useFeedSync()
  
  return (
    <>
      <button onClick={syncNow} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>
      <p>Last sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}</p>
      {syncErrors.length > 0 && (
        <div className="error">
          {syncErrors.map(e => <p key={e.source}>{e.source}: {e.error}</p>)}
        </div>
      )}
    </>
  )
}
```

---

## Data Integrity

### Transactional Consistency

- **Database constraints** ensure no duplicate items per source
- **Foreign key cascades** clean up items when sources are deleted
- **RLS policies** prevent cross-user data access
- **Sync logs** provide audit trail of all operations

### Deduplication Guarantees

```sql
-- Unique constraint prevents duplicates
ALTER TABLE feed_items
ADD CONSTRAINT unique_item_per_source 
UNIQUE(source_id, external_id)
```

If an item with same external_id is inserted:
- **Conflict strategy**: Use content hash to detect updates
- **Result**: Item updated instead of duplicated

### Content Hash Verification

Detect when items are updated (e.g., RSS item edited):

```typescript
// Old sync: item stored with hash "abc123"
// New sync: same external_id, hash "def456"
// Result: Item marked as updated, content refreshed
```

---

## Monitoring & Logging

### Console Logs

All sync operations are logged for debugging:

```
[FeedSync] Syncing 25 items for source abc-123 (TechNews)
[FeedSync] Sync completed for source abc-123:
  - itemsAdded: 20
  - itemsUpdated: 3
  - itemsSkipped: 2
  - errors: 0
  - duration: 1245ms
```

### Sync Logs Query

Retrieve sync history via database:

```typescript
const logs = await getSyncHistory(sourceId, 50)
logs.forEach(log => {
  console.log(`${log.status}: ${log.items_added} added, ${log.items_updated} updated`)
  if (log.error_message) console.error(log.error_message)
})
```

### Error Tracking

Errors are categorized by type:

| Code | Meaning | Action |
|------|---------|--------|
| `ITEM_PROCESS_ERROR` | Item parsing failed | Skip item, log error |
| `ITEM_UPDATE_ERROR` | Database update failed | Retry, notify user |
| `SYNC_ERROR` | Overall sync failed | Notify user, backoff |
| `UNAUTHORIZED` | Authentication failed | Prompt login |

---

## Performance Considerations

### Bulk Operations

- **Batch inserts**: 50-100 items at once (configurable)
- **Index usage**: Queries on source_id, published_at, user_id
- **Pagination**: Default 50 items per query (limit: 1000)

### Database Cleanup

Automatically remove old items:

```typescript
// Run daily/weekly
await cleanupOldItems(userId, 30) // Remove items > 30 days old
```

### Caching Strategy

- **Client-side**: Zustand store keeps recent items in memory
- **Database**: Items persisted indefinitely (until cleanup)
- **Sync logs**: Kept for 90 days for audit purposes

---

## Troubleshooting

### Issue: Duplicate items appearing

**Cause:** External ID mismatch or duplicate allowed by sync

**Solution:**
1. Check `external_id` generation in feed source
2. Verify UNIQUE constraint exists on `(source_id, external_id)`
3. Clear duplicates manually if needed

### Issue: Sync stuck or timeout

**Cause:** Large feed size, network issues, or API rate limit

**Solution:**
1. Increase `timeoutMs` in sync options
2. Reduce `limit` items per sync
3. Check API rate limits for source
4. Review sync logs for error details

### Issue: Items not updating after edit

**Cause:** Content hash unchanged or `updateExisting: false`

**Solution:**
1. Enable `updateExisting: true` in sync options
2. Verify hash computation includes edited fields
3. Check item's `last_synced_at` timestamp

---

## Future Enhancements

- [ ] Incremental sync (only fetch since last sync)
- [ ] Compression for sync payloads
- [ ] WebSocket real-time sync updates
- [ ] Differential sync for large feeds
- [ ] Smart retry with exponential backoff
- [ ] Sync metrics dashboard
- [ ] User-configurable cleanup retention
