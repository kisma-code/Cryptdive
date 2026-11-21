#!/usr/bin/env python3
"""Make the CrazyGames upload zip: dist/cryptdive-crazygames.zip

Usage (from the repo root):  python3 tools/build-crazygames.py

The zip has its own index.html (made from index.html): it loads the CrazyGames SDK
and crazygames.js, and it has no Google login (auth.js), no PWA manifest, no service
worker and no privacy link. The game code (game.js, style.css) is the same.
"""
import os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'dist')
SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
FILES = ['game.js', 'style.css', 'crazygames.js', 'icons/icon-192.png']


def make_index():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    def cut(pattern):
        nonlocal html
        html, n = re.subn(pattern, '', html)
        if n == 0:
            sys.exit('build-crazygames: pattern not found: ' + pattern)
    cut(r'\s*<link rel="manifest"[^>]*>')
    cut(r'\s*<link rel="apple-touch-icon"[^>]*>')
    cut(r'\s*<meta name="apple-mobile-web-app-[^>]*>')
    cut(r'\s*<script type="module" src="auth.js"></script>')
    cut(r'\s*<script src="game.js"></script>')
    # The SDK first, then crazygames.js (it loads game.js when the SDK is ready).
    html = html.replace('</body>', f'  <script src="{SDK}"></script>\n  <script src="crazygames.js"></script>\n</body>')
    return html


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, 'cryptdive-crazygames.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('index.html', make_index())
        for f in FILES:
            z.write(os.path.join(ROOT, f), f)
    print(out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
