// API module for Dana PO Wizard
// Provides functions for authentication, data storage (PO records), and notifications.
// Supports two storage backends: Supabase (when SUPABASE_URL and SUPABASE_KEY are present on window)
// and a fallback using browser localStorage for offline/standalone use.

(() => {
  // Detect Supabase credentials on global scope
  const SUPA_URL = window.SUPABASE_URL;
  const SUPA_KEY = window.SUPABASE_KEY;
  let supa = null;
  let currentUser = null;
  let authListeners = [];

  // Local storage keys
  const USERS_KEY = 'po_users';
  const RECORDS_KEY = 'po_records';
  const NOTIFS_KEY = 'po_notifications';

  /**
   * Initialise backend. If Supabase keys are available, it sets up the Supabase client
   * and subscription to auth state changes. Otherwise it falls back to localStorage.
   */
  async function init() {
    if (SUPA_URL && SUPA_KEY) {
      // Attempt to initialise Supabase; fall back gracefully if script is missing or init fails
      try {
        if (!window.supabase) {
          console.warn('Supabase script missing; extended features may not work. Falling back to localStorage.');
          throw new Error('supabase global missing');
        }
        supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
        // Get current session
        const { data: { session } } = await supa.auth.getSession();
        currentUser = session?.user || null;
        // Subscribe to auth state changes
        supa.auth.onAuthStateChange((_event, session) => {
          currentUser = session?.user || null;
          authListeners.forEach(fn => fn(currentUser));
        });
      } catch (e) {
        console.warn('Supabase init failed, falling back to localStorage:', e);
        supa = null;
        // Local fallback: restore current user from sessionStorage if available
        const uid = sessionStorage.getItem('po_current_uid');
        if (uid) {
          const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
          currentUser = users.find(u => u.id === uid) || null;
        }
      }
    } else {
      // local fallback: try to restore current user from sessionStorage
      const uid = sessionStorage.getItem('po_current_uid');
      if (uid) {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        currentUser = users.find(u => u.id === uid) || null;
      }
    }
    return currentUser;
  }

  /** Register a callback fired on auth state change */
  function onAuthStateChange(fn) {
    authListeners.push(fn);
  }

  /**
   * Utility: generate a UUID v4 string (local fallback for record IDs)
   */
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Sign up a new user. Returns { data, error }
   */
  async function signUp({ email, password, displayName }) {
    if (supa) {
      return await supa.auth.signUp({ email, password, options: { data: { displayName } } });
    }
    // local fallback
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.some(u => u.email === email)) {
      return { error: { message: 'آدرس ایمیل قبلاً استفاده شده است.' } };
    }
    const id = uuidv4();
    const user = { id, email, password, displayName: displayName || email };
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    currentUser = user;
    sessionStorage.setItem('po_current_uid', id);
    authListeners.forEach(fn => fn(currentUser));
    return { data: user, error: null };
  }

  /** Sign in an existing user. Returns { data, error } */
  async function signIn({ email, password }) {
    // Always handle the built-in guest account before delegating to Supabase.
    // If credentials are guest/guest, ensure a local guest user exists and return it.
    if (email === 'guest' && password === 'guest') {
      // Use the local storage user list regardless of Supabase presence.
      let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      let guestUser = users.find(u => u.email === 'guest') || null;
      if (!guestUser) {
        const id = uuidv4();
        guestUser = { id, email: 'guest', password: 'guest', displayName: 'Guest' };
        users.push(guestUser);
      } else {
        // Ensure password is set to 'guest'
        guestUser.password = 'guest';
      }
      // Persist updated users list
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      // Set current user and notify listeners
      currentUser = guestUser;
      sessionStorage.setItem('po_current_uid', guestUser.id);
      authListeners.forEach(fn => fn(currentUser));
      return { data: guestUser, error: null };
    }

    // If Supabase is configured, use it for all non-guest logins.
    if (supa) {
      return await supa.auth.signInWithPassword({ email, password });
    }

    // Local auth fallback: look up in localStorage
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return { error: { message: 'کاربر یافت نشد یا رمز نادرست است.' } };
    }
    currentUser = user;
    sessionStorage.setItem('po_current_uid', user.id);
    authListeners.forEach(fn => fn(currentUser));
    return { data: user, error: null };
  }

  /** Sign out */
  async function signOut() {
    if (supa) {
      await supa.auth.signOut();
      currentUser = null;
      authListeners.forEach(fn => fn(currentUser));
      return;
    }
    sessionStorage.removeItem('po_current_uid');
    currentUser = null;
    authListeners.forEach(fn => fn(currentUser));
  }

  /** Get current user */
  function getCurrentUser() {
    return currentUser;
  }

  // ---------------------- Records ----------------------

  /** Save a PO record with attached file
   * @param {Object} opts - { meta, items, attachments, clauses, fileBlob }
   * @returns {Object} inserted record { id }
   */
  async function savePoRecord(opts) {
    const { meta, items, attachments, clauses, fileBlob } = opts;
    if (!currentUser) throw new Error('باید وارد شوید.');
    const record = {
      id: uuidv4(),
      owner_uid: currentUser?.id || currentUser?.user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'pending',
      title: meta.subject || 'PO',
      po_number: meta.poNumber || '',
      summary: `${meta.subject || ''} - ${meta.amount || ''} ${meta.currencyFa || ''}`,
      meta_json: { meta, items, attachments, clauses },
      assignees: [],
    };
    if (supa) {
      // insert record row
      const { data: recData, error: recErr } = await supa.from('po_records').insert(record).select().single();
      if (recErr) throw recErr;
      // upload file
      if (fileBlob) {
        const filename = `po-${record.po_number || record.id}-${Date.now()}.docx`;
        const { error: uploadErr } = await supa.storage.from('po-files').upload(`${recData.id}/${filename}`, fileBlob, { upsert: true });
        if (uploadErr) throw uploadErr;
      }
      return recData;
    }
    // local fallback: base64 encode file
    let fileBase64 = null;
    if (fileBlob) {
      fileBase64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(fileBlob);
      });
    }
    record.fileBase64 = fileBase64;
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    records.push(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return record;
  }

  /** Fetch records owned by the current user */
  async function fetchMyRecords() {
    if (!currentUser) return [];
    if (supa) {
      const { data, error } = await supa.from('po_records').select('*').eq('owner_uid', currentUser.id || currentUser.user?.id).order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return records.filter(r => r.owner_uid === currentUser.id).sort((a, b) => (b.updated_at || 0).localeCompare(a.updated_at || 0));
  }

  /** Fetch records assigned to the current user (excluding owned) */
  async function fetchAssignedRecords() {
    if (!currentUser) return [];
    if (supa) {
      const { data, error } = await supa.from('po_records').select('*').contains('assignees', [currentUser.id || currentUser.user?.id]).order('updated_at', { ascending: false });
      if (error) throw error;
      return data.filter(r => r.owner_uid !== (currentUser.id || currentUser.user?.id));
    }
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return records.filter(r => r.assignees && r.assignees.includes(currentUser.id) && r.owner_uid !== currentUser.id);
  }

  /** Update the status of a record and optionally add a note. */
  async function updateRecordStatus(id, status) {
    if (!currentUser) throw new Error('ورود لازم است');
    if (supa) {
      // fetch record to know owner and assignees
      const { data: rec, error: recErr } = await supa.from('po_records').select('*').eq('id', id).single();
      if (recErr) throw recErr;
      // update record
      const { data: updatedRec, error } = await supa.from('po_records').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      // notify owner of status change when reviewer updates
      const ownerUid = rec.owner_uid;
      if (ownerUid && ownerUid !== (currentUser.id || currentUser.user?.id)) {
        await supa.from('notifications').insert({ id: uuidv4(), to_uid: ownerUid, from_uid: currentUser.id || currentUser.user?.id, type: 'review_feedback', po_id: id, created_at: new Date().toISOString(), read: false, payload_json: { status } });
      }
      return updatedRec;
    }
    // local fallback
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const rec = records.find(r => r.id === id);
    if (rec) {
      rec.status = status;
      rec.updated_at = new Date().toISOString();
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
      // push notification to owner if not same user
      const notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
      if (rec.owner_uid && rec.owner_uid !== currentUser.id) {
        notifs.push({ id: uuidv4(), to_uid: rec.owner_uid, from_uid: currentUser.id, type: 'review_feedback', po_id: id, created_at: new Date().toISOString(), read: false, payload: { status } });
        localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
      }
    }
    return rec;
  }

  /** Add assignee by email; create notification */
  async function addAssignee(recordId, email) {
    if (!currentUser) throw new Error('ورود لازم است');
    if (supa) {
      // lookup user by email
      const { data: users, error: userErr } = await supa.from('users').select('id,email').eq('email', email).maybeSingle();
      if (userErr || !users) throw userErr || new Error('کاربر پیدا نشد');
      const assigneeId = users.id;
      // update record
      const { data: rec, error: recErr } = await supa.from('po_records').select('*').eq('id', recordId).single();
      if (recErr) throw recErr;
      const newAssignees = Array.from(new Set([...(rec.assignees || []), assigneeId]));
      await supa.from('po_records').update({ assignees: newAssignees, updated_at: new Date().toISOString(), status: 'in_review' }).eq('id', recordId);
      // notify
      await supa.from('notifications').insert({ id: uuidv4(), to_uid: assigneeId, type: 'review_request', po_id: recordId, from_uid: currentUser.id, created_at: new Date().toISOString(), read: false, payload_json: {} });
      return { success: true };
    }
    // local fallback
    // find user id by email
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const assignee = users.find(u => u.email === email);
    if (!assignee) throw new Error('کاربر یافت نشد');
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const rec = records.find(r => r.id === recordId);
    if (!rec) throw new Error('رکورد یافت نشد');
    rec.assignees = Array.from(new Set([...(rec.assignees || []), assignee.id]));
    rec.status = 'in_review';
    rec.updated_at = new Date().toISOString();
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    // create notification
    const notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
    notifs.push({ id: uuidv4(), to_uid: assignee.id, from_uid: currentUser.id, type: 'review_request', po_id: recordId, created_at: new Date().toISOString(), read: false, payload: {} });
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
    return { success: true };
  }

  /** Fetch notifications for current user */
  async function fetchNotifications() {
    if (!currentUser) return [];
    if (supa) {
      const { data, error } = await supa.from('notifications').select('*').eq('to_uid', currentUser.id || currentUser.user?.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
    return notifs.filter(n => n.to_uid === currentUser.id).sort((a,b) => b.created_at.localeCompare(a.created_at));
  }

  /** Mark a notification as read */
  async function markNotificationRead(id) {
    if (!currentUser) return;
    if (supa) {
      await supa.from('notifications').update({ read: true }).eq('id', id);
      return;
    }
    const notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
    const notif = notifs.find(n => n.id === id);
    if (notif) notif.read = true;
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
  }

  /** Download file associated with record; returns Blob (Supabase) or base64 (local) */
  async function downloadFile(recordId) {
    if (!currentUser) throw new Error('ورود لازم است');
    if (supa) {
      // get file list under record folder
      const { data: list, error: listErr } = await supa.storage.from('po-files').list(recordId);
      if (listErr || !list || list.length === 0) throw listErr || new Error('فایل یافت نشد');
      const fileName = list[0].name;
      const { data, error } = await supa.storage.from('po-files').download(`${recordId}/${fileName}`);
      if (error) throw error;
      return data;
    }
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const rec = records.find(r => r.id === recordId);
    if (!rec || !rec.fileBase64) throw new Error('فایل یافت نشد');
    // convert base64 to Blob
    const byteString = atob(rec.fileBase64);
    const arrayBuffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) arrayBuffer[i] = byteString.charCodeAt(i);
    return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // Expose API
  window.POWizardAPI = {
    init,
    onAuthStateChange,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    savePoRecord,
    fetchMyRecords,
    fetchAssignedRecords,
    updateRecordStatus,
    addAssignee,
    fetchNotifications,
    markNotificationRead,
    downloadFile
  };
})();