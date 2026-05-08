// Service worker — handles all Gmail API calls via message passing from popup.js.
importScripts('utils.js');

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(result => sendResponse({ success: true, ...result }))
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(request) {
  switch (request.action) {
    case 'GET_TOKEN':    return getToken(request.interactive ?? false);
    case 'REVOKE_TOKEN': return revokeToken(request.token);
    case 'FETCH_LABELS': return fetchLabels(request.token);
    case 'SEARCH_EMAILS': return searchEmails(request.filters, request.token);
    case 'TRASH_EMAILS':  return trashEmails(request.ids, request.token);
    case 'UNTRASH_EMAILS': return untrashEmails(request.ids, request.token);
    default: throw new Error(`Unknown action: ${request.action}`);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, token => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve({ token });
      }
    });
  });
}

function revokeToken(token) {
  return new Promise(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve({}));
  });
}

// ── Labels ────────────────────────────────────────────────────────────────────

async function fetchLabels(token) {
  const data = await gmailFetch(`${GMAIL_API}/labels`, token);
  return { labels: data.labels || [] };
}

// ── Search ────────────────────────────────────────────────────────────────────

async function searchEmails(filters, token) {
  const query = buildGmailQuery(filters);
  const params = new URLSearchParams({ maxResults: '100' });
  if (query) params.set('q', query);
  if (filters.labelId) params.append('labelIds', filters.labelId);

  const data = await gmailFetch(`${GMAIL_API}/messages?${params}`, token);
  if (!data.messages?.length) return { emails: [], total: 0 };

  const msgs = await fetchMessagesBatch(data.messages.slice(0, 100), token);
  return { emails: msgs, total: data.resultSizeEstimate || msgs.length };
}

async function fetchMessagesBatch(messages, token) {
  const BATCH = 20;
  const results = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const slice = messages.slice(i, i + BATCH);
    const fetched = await Promise.all(slice.map(m => fetchMessageMeta(m.id, token)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}

async function fetchMessageMeta(id, token) {
  const url = `${GMAIL_API}/messages/${id}?format=metadata` +
    `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
  try {
    const data = await gmailFetch(url, token);
    return {
      id: data.id,
      from:    parseEmailHeader(data.payload?.headers, 'From'),
      subject: parseEmailHeader(data.payload?.headers, 'Subject') || '(no subject)',
      date:    parseEmailHeader(data.payload?.headers, 'Date'),
      labelIds: data.labelIds || [],
    };
  } catch {
    return null;
  }
}

// ── Trash / Untrash ───────────────────────────────────────────────────────────

async function trashEmails(ids, token) {
  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`${GMAIL_API}/messages/${id}/trash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r; })
    )
  );
  const trashed = results.filter(r => r.status === 'fulfilled').length;
  return { trashed, failed: ids.length - trashed };
}

async function untrashEmails(ids, token) {
  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(`${GMAIL_API}/messages/${id}/untrash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r; })
    )
  );
  const untrashed = results.filter(r => r.status === 'fulfilled').length;
  return { untrashed, failed: ids.length - untrashed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gmailFetch(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
  return res.json();
}
