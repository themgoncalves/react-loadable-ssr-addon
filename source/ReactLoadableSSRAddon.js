/**
 * react-loadable-ssr-addon
 * @author Marcos Gonçalves <contact@themgoncalves.com>
 * @version 0.1.3
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import { getFileExtension, computeIntegrity } from './utils';

// Webpack plugin name
const PLUGIN_NAME = 'ReactLoadableSSRAddon';

// Default plugin options
const defaultOptions = {
  filename: 'assets-manifest.json',
  integrity: false,
  integrityAlgorithms: ['sha256', 'sha384', 'sha512'],
  integrityPropertyName: 'integrity',
};

/**
 * React Loadable SSR Add-on for Webpack
 * @class ReactLoadableSSRAddon
 * @desc Generate application assets manifest with its dependencies.
 */
export default class ReactLoadableSSRAddon {
  /**
   * @constructs ReactLoadableSSRAddon
   * @param options
   */
  constructor(options = defaultOptions) {
    this.options = { ...defaultOptions, ...options };
    this.compiler = null;
    this.stats = null;
    this.entrypoints = new Set();
    this.assetsByName = new Map();
    this.manifest = {};
  }

  /**
   * Get application assets chunks
   * @method getAssets
   * @param {array} assetsChunk - Webpack application chunks
   * @returns {Map<string, object>}
   */
  getAssets(assetsChunk) {
    for (let i = 0; i < assetsChunk.length; i += 1) {
      const chunk = assetsChunk[i];
      const {
        id, files, siblings = [], hash,
      } = chunk;

      const keys = this.getChunkOrigin(chunk);

      for (let j = 0; j < keys.length; j += 1) {
        this.assetsByName.set(keys[j], {
          id, files, hash, siblings,
        });
      }
    }

    return this.assetsByName;
  }

  /**
   * Get Application Entry points
   * @method getEntrypoints
   * @param {object} entrypoints - Webpack entry points
   * @returns {Set<string>} - Application Entry points
   */
  getEntrypoints(entrypoints) {
    const entry = Object.keys(entrypoints);
    for (let i = 0; i < entry.length; i += 1) {
      this.entrypoints.add(entry[i]);
    }

    return this.entrypoints;
  }

  /**
   * Check if request is from Dev Server
   * aka webpack-dev-server
   * @method isRequestFromDevServer
   * @returns {boolean} - True or False
   */
  isRequestFromDevServer() {
    if (process.argv.some(arg => arg.includes('webpack-dev-server'))) { return true; }
    return this.compiler.outputFileSystem && this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem';
  }

  /**
   * Get application chunk origin
   * @method getChunkOrigin
   * @param {object} id  - Webpack application chunk id
   * @param {object} names  - Webpack application chunk names
   * @param {object} modules  - Webpack application chunk modules
   * @returns {array} Chunk Keys
   */
  /* eslint-disable class-methods-use-this */
  getChunkOrigin({ id, names, modules }) {
    const origins = new Set();
    for (let i = 0; i < modules.length; i += 1) {
      const { reasons } = modules[i];
      for (let j = 0; j < reasons.length; j += 1) {
        const { type, userRequest } = reasons[j];
        if (type === 'import()') {
          origins.add(userRequest);
        }
      }
    }

    if (origins.size === 0) { return [names[0] || id]; }

    return Array.from(origins);
  }
  /* eslint-enabled */

  /**
   * Get assets manifest output path
   *
   * @method getManifestOutputPath
   * @returns {string} - Output path containing path + filename.
   */
  getManifestOutputPath() {
    if (path.isAbsolute(this.options.filename)) {
      return this.options.filename;
    }

    if (this.isRequestFromDevServer()) {
      let outputPath = (this.compiler.options.devServer.outputPath || this.compiler.outputPath || '/');

      if (outputPath === '/') {
        console.warn('Please use an absolute path in options.output when using webpack-dev-server.'); // eslint-disable-line no-console
        outputPath = this.compiler.context || process.cwd();
      }

      return path.resolve(outputPath, this.options.filename);
    }

    return path.resolve(this.compiler.outputPath, this.options.filename);
  }

  /**
   * Webpack apply method.
   * @method apply
   * @param {object} compiler - Webpack compiler object
   * It represents the fully configured Webpack environment.
   * @See {@link https://github.com/webpack/docs/wiki/how-to-write-a-plugin#compiler-and-compilation}
   */
  apply(compiler) {
    this.compiler = compiler;
    // check if webpack 4 `hooks` exists
    // otherwise, will fallback to the old syntax
    // @See {@Link https://webpack.js.org/api/compiler-hooks/}
    if (compiler.hooks) {
      compiler.hooks.emit.tapAsync(PLUGIN_NAME, this.handleEmit.bind(this));
    } else {
      compiler.plugin('emit', this.handleEmit.bind(this));
    }
  }

  /**
   * Handles emit event from Webpack
   * @desc The Webpack Compiler begins with emitting the generated assets.
   * Here plugins have the last chance to add assets to the `c.assets` array.
   * @See {@Link https://github.com/webpack/docs/wiki/plugins#emitc-compilation-async}
   * @method handleEmit
   * @param {object} compilation
   * @param {function} callback
   */
  handleEmit(compilation, callback) {
    this.stats = compilation.getStats().toJson();
    this.options.publicPath = (compilation.outputOptions
      ? compilation.outputOptions.publicPath
      : compilation.options.output.publicPath)
      || '';
    this.getEntrypoints(this.stats.entrypoints);
    this.getAssets(this.stats.chunks);
    this.processAssets(compilation.assets);
    this.writeAssetsFile();

    callback();
  }

  /**
   * Process Application Assets Manifest
   * @method processAssets
   * @param {object} originAssets - Webpack raw compilations assets
   */
  /* eslint-disable object-curly-newline, no-restricted-syntax */
  processAssets(originAssets) {
    const assets = {};
    const origins = {};
    const { entrypoints } = this;

    this.assetsByName.forEach((value, key) => {
      const { files, id, siblings, hash } = value;

      if (!origins[key]) { origins[key] = []; }

      siblings.push(id);
      for (let i = 0; i < siblings.length; i += 1) {
        const sibling = siblings[i];
        if (!origins[key].includes(sibling)) {
          origins[key].push(sibling);
        }
      }

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const currentAsset = originAssets[file];
        const ext = getFileExtension(file).replace(/^\.+/, '').toLowerCase();

        if (!assets[id]) { assets[id] = {}; }
        if (!assets[id][ext]) { assets[id][ext] = []; }

        if (currentAsset
          && this.options.integrity
          && !currentAsset[this.options.integrityPropertyName]) {
          currentAsset[this.options.integrityPropertyName] = computeIntegrity(
            this.options.integrityAlgorithms,
            currentAsset.source(),
          );
        }

        assets[id][ext].push({
          file,
          hash,
          publicPath: url.resolve(this.options.publicPath || '', file),
          integrity: currentAsset[this.options.integrityPropertyName],
        });
      }
    });

    // create assets manifest object
    this.manifest = {
      entrypoints: Array.from(entrypoints),
      origins,
      assets,
    };
  }

  /**
   * Write Assets Manifest file
   * @method writeAssetsFile
   */
  writeAssetsFile() {
    const filePath = this.getManifestOutputPath();
    const fileDir = path.dirname(filePath);
    const json = JSON.stringify(this.manifest, null, 2);
    try {
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
      }
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }

    fs.writeFileSync(filePath, json);
  }
}
