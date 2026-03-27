import type { NextConfig } from 'next';
import path from 'path';

const config: NextConfig = {
  output: 'standalone',
  // Skip redundant type checking during build — types are validated by
  // the workspace-level tsc builds. This avoids a known @types/react@19.2.x
  // regression where ReactElement is not assignable to ReactPortal.
  typescript: { ignoreBuildErrors: true },
  // Point to monorepo root so standalone output includes all workspace packages
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  // ESM-only packages that must be transpiled by Webpack
  transpilePackages: [
    // react-markdown ecosystem
    'react-markdown',
    'remark-gfm',
    'remark-parse',
    'remark-rehype',
    'remark-stringify',
    'rehype-highlight',
    'unified',
    'bail',
    'is-plain-obj',
    'trough',
    'vfile',
    'vfile-message',
    'devlop',
    // unist utilities
    'unist-util-stringify-position',
    'unist-util-find-after',
    'unist-util-is',
    'unist-util-position',
    'unist-util-visit',
    'unist-util-visit-parents',
    // mdast utilities
    'mdast-util-from-markdown',
    'mdast-util-to-hast',
    'mdast-util-to-markdown',
    'mdast-util-to-string',
    'mdast-util-gfm',
    'mdast-util-gfm-autolink-literal',
    'mdast-util-gfm-footnote',
    'mdast-util-gfm-strikethrough',
    'mdast-util-gfm-table',
    'mdast-util-gfm-task-list-item',
    'mdast-util-find-and-replace',
    'mdast-util-phrasing',
    'mdast-util-mdx-expression',
    'mdast-util-mdx-jsx',
    'mdast-util-mdxjs-esm',
    // hast utilities
    'hast-util-to-jsx-runtime',
    'hast-util-whitespace',
    'hast-util-is-element',
    'hast-util-to-text',
    // micromark
    'micromark',
    'micromark-util-combine-extensions',
    'micromark-extension-gfm',
    'micromark-extension-gfm-autolink-literal',
    'micromark-extension-gfm-footnote',
    'micromark-extension-gfm-strikethrough',
    'micromark-extension-gfm-table',
    'micromark-extension-gfm-tagfilter',
    'micromark-extension-gfm-task-list-item',
    'micromark-core-commonmark',
    'micromark-factory-destination',
    'micromark-factory-label',
    'micromark-factory-space',
    'micromark-factory-title',
    'micromark-factory-whitespace',
    'micromark-util-character',
    'micromark-util-chunked',
    'micromark-util-classify-character',
    'micromark-util-decode-numeric-character-reference',
    'micromark-util-decode-string',
    'micromark-util-encode',
    'micromark-util-html-tag-name',
    'micromark-util-normalize-identifier',
    'micromark-util-resolve-all',
    'micromark-util-sanitize-uri',
    'micromark-util-subtokenize',
    'micromark-util-symbol',
    'micromark-util-types',
    // character utilities
    'character-entities',
    'character-entities-html4',
    'character-entities-legacy',
    'character-reference-invalid',
    // html/css token utils
    'property-information',
    'space-separated-tokens',
    'comma-separated-tokens',
    // syntax highlighting
    'lowlight',
    'highlight.js',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default config;
