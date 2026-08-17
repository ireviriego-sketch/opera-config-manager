function computeDiff(oldValues, newValues) {
  if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object') return null;

  const diff = {};
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of keys) {
    const before = oldValues[key];
    const after = newValues[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = { before, after };
    }
  }

  return Object.keys(diff).length ? diff : null;
}

module.exports = {
  computeDiff
};
