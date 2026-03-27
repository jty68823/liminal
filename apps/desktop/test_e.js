try {
  const e = require('electron');
  const fs = require('fs');
  const keys = Object.keys(e || {});
  fs.writeFileSync('C:/Users/USER/Downloads/test_electron_result.txt',
    'electron type=' + typeof e + '\nkeys=' + JSON.stringify(keys.slice(0,15)) + '\napp=' + typeof e.app + '\n');
} catch(err) {
  require('fs').writeFileSync('C:/Users/USER/Downloads/test_electron_result.txt', 'ERROR: ' + err.message + '\n');
}
