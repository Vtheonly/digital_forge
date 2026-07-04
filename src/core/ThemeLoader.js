/**
 * ThemeLoader.js — Loads theme files (JS or JSON) and validates them
 *
 * Themes can be:
 *   - JS modules that export an object: `module.exports = { name: '...', ... }`
 *   - JSON files: `{ "name": "...", ... }`
 *   - Inline JSON via CLI: `--theme-json '{"name":"x",...}'`
 *
 * Usage:
 *   const loader = new ThemeLoader(logger);
 *   const theme = loader.load('themes/MyTheme.js');
 *   // → validated theme object
 */

const fs = require('fs');
const path = require('path');
const { validateTheme } = require('./Theme');
const { ConfigError } = require('../utils/errors');
const { fileExists } = require('../utils/fs');

class ThemeLoader {
  constructor(logger) {
    this.logger = logger && typeof logger.child === 'function'
      ? logger.child('theme')
      : logger || console;
  }

  /**
   * Load a theme from a file path or inline JSON.
   * @param {string} source — file path (themes/X.js or themes/X.json) or inline JSON
   * @returns {Object} validated theme object
   */
  load(source) {
    if (!source) return null;

    // Inline JSON?
    if (source.startsWith('{')) {
      try {
        const theme = JSON.parse(source);
        validateTheme(theme);
        this.logger.info('Loaded inline theme', { name: theme.name });
        return theme;
      } catch (e) {
        throw new ConfigError(`Invalid inline theme JSON: ${e.message}`);
      }
    }

    // File path
    const fullPath = path.resolve(source);
    if (!fileExists(fullPath)) {
      throw new ConfigError(`Theme file not found: ${fullPath}`);
    }

    let theme;
    if (fullPath.endsWith('.json')) {
      theme = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } else if (fullPath.endsWith('.js')) {
      // Clear require cache so hot-reload works during development
      delete require.cache[require.resolve(fullPath)];
      theme = require(fullPath);
    } else {
      throw new ConfigError(`Theme file must be .js or .json: ${fullPath}`);
    }

    validateTheme(theme);
    this.logger.info('Loaded theme', { name: theme.name, source: fullPath });
    return theme;
  }
}

module.exports = { ThemeLoader };
