// Supabase is configured only on the GitHub Pages build. The publishable key is
// public; database and Storage policies enforce ownership with auth.uid().
window.createTisheCloudStore = function createTisheCloudStore(client, onStatus) {
  let user = null;
  let revision = 0;
  let pending = Promise.resolve();
  let failed = false;
  const photoUrls = new Map();

  async function load(nextUser) {
    await pending.catch(() => {});
    user = nextUser;
    revision = 0;
    failed = false;
    photoUrls.clear();
    if (!user) return null;
    const { data, error } = await client.from('tishe_state')
      .select('document,revision').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data) revision = Number(data.revision);
    return data?.document || null;
  }

  async function persist(snapshot) {
    if (!user) throw Error('Sign in required');
    const table = client.from('tishe_state');
    if (!revision) {
      const { data, error } = await table.insert({ user_id: user.id, document: snapshot, revision: 1 })
        .select('revision').single();
      if (error) throw error;
      revision = Number(data.revision);
    } else {
      const { data, error } = await table.update({ document: snapshot, revision: revision + 1, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('revision', revision).select('revision').maybeSingle();
      if (error) throw error;
      if (!data) throw Error('Данные изменились на другом устройстве. Скачай копию перед обновлением страницы.');
      revision = Number(data.revision);
    }
    onStatus('saved');
    return true;
  }

  function save(document) {
    if (!user || failed) return false;
    const snapshot = JSON.parse(JSON.stringify(document));
    onStatus('saving');
    pending = pending.then(() => persist(snapshot)).catch(error => {
      failed = true;
      onStatus('error', error);
      return false;
    });
    return true;
  }

  async function uploadPhoto(blob, id) {
    if (!user) throw Error('Sign in required');
    const path = `${user.id}/${id}.jpg`;
    const { error } = await client.storage.from('tishe-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  }

  async function signedPhotoUrl(path) {
    if (!user || !path?.startsWith(`${user.id}/`)) return '';
    const { data, error } = await client.storage.from('tishe-photos').createSignedUrl(path, 3600);
    if (error) throw error;
    photoUrls.set(path, data.signedUrl);
    return data.signedUrl;
  }

  async function removePhoto(path) {
    if (!user || !path?.startsWith(`${user.id}/`)) return;
    const { error } = await client.storage.from('tishe-photos').remove([path]);
    if (error) throw error;
    photoUrls.delete(path);
  }

  async function downloadPhoto(path) {
    if (!user || !path?.startsWith(`${user.id}/`)) throw Error('Photo is not yours');
    const { data, error } = await client.storage.from('tishe-photos').download(path);
    if (error) throw error;
    return data;
  }

  return {
    load, save, uploadPhoto, signedPhotoUrl, removePhoto, downloadPhoto,
    get user() { return user; },
    get revision() { return revision; },
    get failed() { return failed; },
    get pending() { return pending; },
    photoUrl(path) { return photoUrls.get(path) || ''; }
  };
};
