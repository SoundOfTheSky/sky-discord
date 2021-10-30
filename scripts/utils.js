/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const importRE = /import .*@\//;
function resolvePathAliases(root, filePath, t) {
  let el;
  while ((el = importRE.exec(t)) !== null)
    t = t.replace(
      el[0],
      el[0].slice(0, -2) +
        (path.relative(filePath.slice(0, filePath.lastIndexOf('/')), root).replace(/\\/g, '/') || '.') +
        '/',
    );
  return t;
}
function on(host, functionName, before, after) {
  const originalFunction = host[functionName];
  host[functionName] = function () {
    before && before(...arguments);
    let result = originalFunction && originalFunction(...arguments);
    if (after) {
      const r = after(result);
      if (r) result = r;
    }
    after && after(result);
    return result;
  };
}
module.exports = {
  resolvePathAliases,
  on,
};
