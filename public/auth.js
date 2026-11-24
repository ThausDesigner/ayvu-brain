// AYVU Brain Auth (Supabase GoTrue OAuth PKCE: Google, GitHub e Magic Link) - Zero dependencias
(function (global) {
  const SUPABASE_URL = 'https://zzysmgqskosskybywhup.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_A_CRQvytUWGGC5n3LJzaKQ_SrP_3zvQ';
  const STORAGE_KEY = 'ayvu-brain-auth-session';
  const PKCE_KEY = 'ayvu-brain-pkce-verifier';

  function base64Url(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createPkce() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const verifier = base64Url(raw);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64Url(new Uint8Array(digest));
    return { verifier, challenge };
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveStored(session) {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function authHeaders(accessToken) {
    const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }

  async function fetchUser(accessToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders(accessToken) });
    if (!res.ok) return null;
    return res.json();
  }

  async function refreshSession(refreshToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.access_token) return null;
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: Date.now() + (Number(data.expires_in || 3600) * 1000),
      user: data.user || (await fetchUser(data.access_token))
    };
    saveStored(session);
    return session;
  }

  async function handleOAuthCallback() {
    const url = new URL(location.href);
    const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (errDesc) {
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      return { error: errDesc };
    }

    const code = url.searchParams.get('code');
    if (code) {
      let verifier = '';
      try { verifier = sessionStorage.getItem(PKCE_KEY) || ''; sessionStorage.removeItem(PKCE_KEY); } catch {}
      url.searchParams.delete('code');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ auth_code: code, code_verifier: verifier })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) {
        return { error: data.error_description || data.msg || 'Não foi possível concluir o login.' };
      }
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_at: Date.now() + (Number(data.expires_in || 3600) * 1000),
        user: data.user || (await fetchUser(data.access_token))
      };
      saveStored(session);
      return { session };
    }

    if (location.hash.includes('access_token=')) {
      const params = new URLSearchParams(location.hash.slice(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';
      const expiresIn = Number(params.get('expires_in') || 3600);
      history.replaceState(null, '', url.pathname + url.search);
      if (accessToken) {
        const user = await fetchUser(accessToken);
        if (user) {
          const session = { access_token: accessToken, refresh_token: refreshToken, expires_at: Date.now() + (expiresIn * 1000), user };
          saveStored(session);
          return { session };
        }
      }
    }
    return { session: null };
  }

  async function initSession() {
    const cb = await handleOAuthCallback();
    if (cb.error) return { session: null, error: cb.error };
    if (cb.session) return { session: cb.session, error: null };

    const stored = loadStored();
    if (!stored?.access_token) return { session: null, error: null };

    if (stored.expires_at && Date.now() > stored.expires_at - 60000 && stored.refresh_token) {
      const refreshed = await refreshSession(stored.refresh_token);
      if (refreshed) return { session: refreshed, error: null };
      saveStored(null);
      return { session: null, error: null };
    }

    if (!stored.user) {
      const user = await fetchUser(stored.access_token);
      if (!user) {
        saveStored(null);
        return { session: null, error: null };
      }
      stored.user = user;
      saveStored(stored);
    }
    return { session: stored, error: null };
  }

  async function signInWithOAuth(provider, redirectPath = '/app') {
    const cleanProvider = provider === 'github' ? 'github' : 'google';
    const redirectTo = `${location.origin}${redirectPath}`;
    const pkce = await createPkce();
    try { sessionStorage.setItem(PKCE_KEY, pkce.verifier); } catch {}
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(cleanProvider)}&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${encodeURIComponent(pkce.challenge)}&code_challenge_method=S256`;
    location.assign(authUrl);
  }

  async function sendMagicLink(email, redirectPath = '/app') {
    const clean = String(email || '').trim();
    if (!clean || !clean.includes('@')) throw new Error('Informe um email válido.');
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        email: clean,
        create_user: true,
        options: { emailRedirectTo: `${location.origin}${redirectPath}` }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.error_description || 'Não foi possível enviar o link de acesso.');
    return { ok: true };
  }

  async function signOut() {
    const stored = loadStored();
    saveStored(null);
    if (stored?.access_token) {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: authHeaders(stored.access_token)
        });
      } catch {}
    }
  }

  function formatUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || meta.user_name || (user.email || '').split('@')[0] || 'Usuário';
    const avatar = meta.avatar_url || meta.picture || '';
    const provider = user.app_metadata?.provider || 'conta';
    return { id: user.id, email: user.email || '', name, avatar, provider };
  }

  global.AyvuAuth = {
    supabaseUrl: SUPABASE_URL,
    initSession,
    signInWithOAuth,
    sendMagicLink,
    signOut,
    formatUser,
    getSession: loadStored
  };
})(window);
