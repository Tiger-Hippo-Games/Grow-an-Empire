const button = document.getElementById('increment');
const count = document.getElementById('count');
const status = document.getElementById('status');
let state;

function showError(error) {
  button.disabled = true;
  status.textContent = `${error.code || 'ERROR'}: ${error.message}. Close and reopen to reload cloud progress.`;
}

button.addEventListener('click', async () => {
  button.disabled = true;
  state.count += 1;
  count.textContent = String(state.count);
  status.textContent = 'Saving…';
  try {
    await Platform.saveGameProgress(state);
    status.textContent = 'Saved. Close and reopen to check persistence.';
    button.disabled = false;
  } catch (error) {
    // Do not retry an uncertain write or overwrite conflicting cloud progress.
    showError(error);
  }
});

async function boot() {
  await Platform.init({ clientVersion: '1.0.0' });
  const player = await Platform.getPlayer();
  const saved = await Platform.getGameProgress();
  state = saved.version === 0 ? { schemaVersion: 1, count: 0 } : saved.progress;
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.count) || state.count < 0) {
    throw new Error('Unrecognized save format; existing progress has been preserved');
  }
  document.getElementById('player').textContent = `${player.displayName || player.username} (${player.authType})`;
  count.textContent = String(state.count);
  status.textContent = 'Progress loaded.';
  button.disabled = false;
  window.parent.postMessage({ type: 'GAME_READY' }, new URL(window.location.href).origin);
}

boot().catch(showError);
