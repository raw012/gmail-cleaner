// popup.js — UI logic for Gmail Cleaner extension

const SYSTEM_LABEL_NAMES = {
  INBOX: 'Inbox',
  SENT: 'Sent',
  DRAFTS: 'Drafts',
  SPAM: 'Spam',
  TRASH: 'Trash',
  STARRED: 'Starred',
  IMPORTANT: 'Important',
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_FORUMS: 'Forums',
  CATEGORY_PERSONAL: 'Personal',
};

const UNDO_MS = 5000;

// State
let authToken = null;
let emails = [];
let selectedIds = new Set();
let lastDeletedIds = [];
let toastTimer = null;

// DOM
const $ = id => document.getElementById(id);
const authView      = $('auth-view');
const mainView      = $('main-view');
const signInBtn     = $('sign-in-btn');
const signOutBtn    = $('sign-out-btn');
const searchBtn     = $('search-btn');
const loadingEl     = $('loading');
const resultsSection = $('results-section');
const emailListEl   = $('email-list');
const resultsCount  = $('results-count');
const selectedCount = $('selected-count');
const deleteBtn     = $('delete-btn');
const selectAllBtn  = $('select-all-btn');
const deselectAllBtn = $('deselect-all-btn');
const statusBar     = $('status-bar');
const toastEl       = $('toast');
const toastMsg      = $('toast-msg');
const undoBtn       = $('undo-btn');
const timerBar      = $('timer-bar');
const labelSelect   = $('filter-label');

document.addEventListener('DOMContentLoaded', async () => {
  signInBtn.addEventListener('click', signIn);
  signOutBtn.addEventListener('click', signOut);
  searchBtn.addEventListener('click', handleSearch);
  selectAllBtn.addEventListener('click', selectAll);
  deselectAllBtn.addEventListener('click', deselectAll);
  deleteBtn.addEventListener('click', handleDelete);
  undoBtn.addEventListener('click', handleUndo);

  // Attempt silent sign-in on open
  const res = await msg({ action: 'GET_TOKEN', interactive: false });
  if (res.success && res.token) {
    await initMain(res.token);
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────

async function signIn() {
  setStatus('Signing in…');
  const res = await msg({ action: 'GET_TOKEN', interactive: true });
  if (res.success && res.token) {
    await initMain(res.token);
  } else {
    setStatus('Sign-in failed: ' + (res.error || 'unknown error'), 'error');
  }
}

async function signOut() {
  if (authToken) await msg({ action: 'REVOKE_TOKEN', token: authToken });
  authToken = null;
  emails = [];
  selectedIds.clear();
  authView.style.display = '';
  mainView.style.display = 'none';
  signOutBtn.style.display = 'none';
  resultsSection.style.display = 'none';
  hideToast();
  setStatus('');
}

async function initMain(token) {
  authToken = token;
  authView.style.display = 'none';
  mainView.style.display = '';
  signOutBtn.style.display = '';

  setStatus('Loading labels…');
  const res = await msg({ action: 'FETCH_LABELS', token });
  if (res.success) {
    populateLabelSelect(res.labels || []);
    setStatus('');
  } else {
    setStatus('Could not load labels: ' + res.error, 'error');
  }
}

// ── Labels ────────────────────────────────────────────────────────────────────

function populateLabelSelect(labels) {
  labelSelect.innerHTML = '<option value="">— Any label —</option>';

  const system = labels.filter(l => l.type === 'system' && SYSTEM_LABEL_NAMES[l.id]);
  const user   = labels.filter(l => l.type === 'user');

  if (system.length) {
    const grp = document.createElement('optgroup');
    grp.label = 'System';
    system.forEach(l => grp.appendChild(makeOption(l.id, SYSTEM_LABEL_NAMES[l.id])));
    labelSelect.appendChild(grp);
  }
  if (user.length) {
    const grp = document.createElement('optgroup');
    grp.label = 'Labels';
    user.forEach(l => grp.appendChild(makeOption(l.id, l.name)));
    labelSelect.appendChild(grp);
  }
}

function makeOption(value, text) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = text;
  return opt;
}

// ── Search ────────────────────────────────────────────────────────────────────

async function handleSearch() {
  const filters = {
    from:     $('filter-from').value.trim(),
    subject:  $('filter-subject').value.trim(),
    dateFrom: $('filter-date-from').value,
    dateTo:   $('filter-date-to').value,
    labelId:  labelSelect.value,
  };

  if (!filters.from && !filters.subject && !filters.dateFrom && !filters.dateTo && !filters.labelId) {
    setStatus('Set at least one filter before searching.', 'error');
    return;
  }

  setLoading(true);
  resultsSection.style.display = 'none';
  selectedIds.clear();
  hideToast();

  const res = await msg({ action: 'SEARCH_EMAILS', filters, token: authToken });
  setLoading(false);

  if (!res.success) {
    if (res.error === 'AUTH_EXPIRED') {
      setStatus('Session expired — please sign in again.', 'error');
      await signOut();
    } else {
      setStatus('Search failed: ' + res.error, 'error');
    }
    return;
  }

  emails = res.emails || [];
  renderEmailList(emails);
  setStatus('');
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderEmailList(list) {
  resultsSection.style.display = '';

  if (!list.length) {
    emailListEl.innerHTML = '<div class="empty-state">No emails match your filters.</div>';
    resultsCount.textContent = '0 emails found';
    deleteBtn.disabled = true;
    selectedCount.textContent = '0 selected';
    return;
  }

  resultsCount.textContent = `${list.length} email${list.length !== 1 ? 's' : ''} found`;
  emailListEl.innerHTML = '';

  list.forEach(email => {
    const item = document.createElement('div');
    item.className = 'email-item' + (selectedIds.has(email.id) ? ' selected' : '');
    item.dataset.id = email.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedIds.has(email.id);

    const body = document.createElement('div');
    body.className = 'email-body';

    const fromEl = document.createElement('div');
    fromEl.className = 'email-from';
    fromEl.textContent = fmtSender(email.from);

    const subjEl = document.createElement('div');
    subjEl.className = 'email-subject';
    subjEl.textContent = email.subject;

    body.appendChild(fromEl);
    body.appendChild(subjEl);

    const dateEl = document.createElement('div');
    dateEl.className = 'email-date';
    dateEl.textContent = fmtDate(email.date);

    item.appendChild(cb);
    item.appendChild(body);
    item.appendChild(dateEl);

    // Clicking the row toggles the checkbox
    item.addEventListener('click', e => {
      if (e.target === cb) return;
      cb.checked = !cb.checked;
      applyToggle(email.id, cb.checked, item);
    });
    cb.addEventListener('change', () => applyToggle(email.id, cb.checked, item));

    emailListEl.appendChild(item);
  });

  updateDeleteBtn();
}

function applyToggle(id, checked, item) {
  if (checked) { selectedIds.add(id); item.classList.add('selected'); }
  else          { selectedIds.delete(id); item.classList.remove('selected'); }
  updateDeleteBtn();
}

function selectAll() {
  emails.forEach(e => selectedIds.add(e.id));
  emailListEl.querySelectorAll('.email-item').forEach(item => {
    item.classList.add('selected');
    item.querySelector('input').checked = true;
  });
  updateDeleteBtn();
}

function deselectAll() {
  selectedIds.clear();
  emailListEl.querySelectorAll('.email-item').forEach(item => {
    item.classList.remove('selected');
    item.querySelector('input').checked = false;
  });
  updateDeleteBtn();
}

function updateDeleteBtn() {
  const n = selectedIds.size;
  selectedCount.textContent = `${n} selected`;
  deleteBtn.disabled = n === 0;
  deleteBtn.textContent = n > 0 ? `Delete Selected (${n})` : 'Delete Selected';
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function handleDelete() {
  const ids = [...selectedIds];
  if (!ids.length) return;

  deleteBtn.disabled = true;
  setStatus(`Moving ${ids.length} email${ids.length !== 1 ? 's' : ''} to trash…`);

  const res = await msg({ action: 'TRASH_EMAILS', ids, token: authToken });

  if (!res.success) {
    setStatus('Delete failed: ' + res.error, 'error');
    updateDeleteBtn();
    return;
  }

  lastDeletedIds = ids;
  emails = emails.filter(e => !selectedIds.has(e.id));
  selectedIds.clear();
  renderEmailList(emails);
  setStatus('');
  showToast(`${res.trashed} email${res.trashed !== 1 ? 's' : ''} moved to trash`);
}

// ── Undo ──────────────────────────────────────────────────────────────────────

async function handleUndo() {
  const ids = [...lastDeletedIds];
  if (!ids.length) return;

  hideToast();
  setStatus(`Restoring ${ids.length} email${ids.length !== 1 ? 's' : ''}…`);

  const res = await msg({ action: 'UNTRASH_EMAILS', ids, token: authToken });
  lastDeletedIds = [];

  if (res.success) {
    setStatus(`${res.untrashed} email${res.untrashed !== 1 ? 's' : ''} restored to inbox`, 'success');
  } else {
    setStatus('Restore failed: ' + res.error, 'error');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(message) {
  clearTimeout(toastTimer);
  toastMsg.textContent = message;
  toastEl.style.display = 'flex';

  // Reset and animate the timer bar
  timerBar.style.transition = 'none';
  timerBar.style.width = '100%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    timerBar.style.transition = `width ${UNDO_MS}ms linear`;
    timerBar.style.width = '0%';
  }));

  toastTimer = setTimeout(hideToast, UNDO_MS);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.style.display = 'none';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setLoading(on) {
  loadingEl.style.display = on ? '' : 'none';
  searchBtn.disabled = on;
}

function setStatus(text, type = '') {
  statusBar.textContent = text;
  statusBar.className = type ? `status-${type}` : '';
}

function fmtSender(from) {
  if (!from) return '(unknown sender)';
  const m = from.match(/^"?([^"<]+)"?\s*<?[^>]*>?$/);
  return m ? m[1].trim() : from;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function msg(payload) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(payload, response => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response from background' });
      }
    });
  });
}
