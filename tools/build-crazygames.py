#!/usr/bin/env python3
"""Make the CrazyGames upload files in dist/crazygames/ (4 files, no folders).

Usage (from the repo root):  python3 tools/build-crazygames.py

CrazyGames does not accept a zip: drag and drop the 4 files into the upload zone.
The build has its own index.html (made from index.html): it loads the CrazyGames SDK
and crazygames.js, and it has no Google login (auth.js), no PWA manifest, no service
worker and no privacy link. The game code (game.js, style.css) is the same.
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'dist', 'crazygames')
SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
FILES = ['game.js', 'style.css', 'crazygames.js']


def make_index():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    def cut(pattern):
        nonlocal html
        html, n = re.subn(pattern, '', html)
        if n == 0:
            sys.exit('build-crazygames: pattern not found: ' + pattern)
    cut(r'\s*<link rel="manifest"[^>]*>')
    cut(r'\s*<link rel="apple-touch-icon"[^>]*>')
    cut(r'\s*<link rel="icon"[^>]*>')  # CrazyGames shows its own icon; no icons/ folder needed
    cut(r'\s*<meta name="apple-mobile-web-app-[^>]*>')
    cut(r'\s*<script type="module" src="auth.js"></script>')
    cut(r'\s*<script src="game.js"></script>')
    # The SDK first, then crazygames.js (it loads game.js when the SDK is ready).
    html = html.replace('</body>', f'  <script src="{SDK}"></script>\n  <script src="crazygames.js"></script>\n</body>')
    return html


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(make_index())
    for name in FILES:
        shutil.copy(os.path.join(ROOT, name), os.path.join(OUT_DIR, name))
    for name in sorted(os.listdir(OUT_DIR)):
        print(os.path.join(OUT_DIR, name), os.path.getsize(os.path.join(OUT_DIR, name)), 'bytes')


if __name__ == '__main__':
    main()
