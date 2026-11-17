#!/usr/bin/env python3
"""Encrypt prices.json -> prices.enc.json (same envelope as the Sharma finance apps).

Format "sharma-enc-v1": AES-GCM 256, key = PBKDF2-HMAC-SHA256(office code,
random 16-byte salt, 600,000 iterations), random 12-byte IV, fresh salt and
IV on every run. The code comes from the SHARMA_PASSCODE environment variable
or a hidden prompt. It is never written to disk, printed or logged.
Only prices.enc.json is committed; prices.json is gitignored.

  Encrypt (default):  python3 tools/encrypt_prices.py
  Decrypt for a look: python3 tools/encrypt_prices.py --decrypt
"""
import argparse, base64, getpass, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ITERATIONS = 600_000
FORMAT = "sharma-enc-v1"

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    sys.exit("Missing package: pip install cryptography")


def get_code():
    code = os.environ.get("SHARMA_PASSCODE")
    if code is None:
        if not sys.stdin.isatty():
            sys.exit("set SHARMA_PASSCODE or run in a terminal to be prompted")
        code = getpass.getpass("Code: ")
    code = code.strip()
    if not code:
        sys.exit("empty code")
    return code


def derive(code, salt, iterations):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(code.encode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decrypt", action="store_true")
    a = ap.parse_args()
    plain_path = os.path.join(ROOT, "prices.json")
    enc_path = os.path.join(ROOT, "prices.enc.json")
    code = get_code()
    if a.decrypt:
        env = json.load(open(enc_path, encoding="utf-8"))
        key = derive(code, base64.b64decode(env["salt"]), env["iterations"])
        pt = AESGCM(key).decrypt(base64.b64decode(env["iv"]), base64.b64decode(env["ciphertext"]), None)
        data = json.loads(pt.decode("utf-8"))
        json.dump(data, open(plain_path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print("Decrypted to %s (local only)." % plain_path)
        return
    data = json.load(open(plain_path, encoding="utf-8"))
    if not isinstance(data.get("entries"), list):
        sys.exit("prices.json has no entries list; nothing written")
    salt, iv = os.urandom(16), os.urandom(12)
    key = derive(code, salt, ITERATIONS)
    ct = AESGCM(key).encrypt(iv, json.dumps(data, ensure_ascii=False).encode("utf-8"), None)
    env = {
        "format": FORMAT, "kdf": "PBKDF2-SHA256", "cipher": "AES-GCM-256",
        "iterations": ITERATIONS,
        "salt": base64.b64encode(salt).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "ciphertext": base64.b64encode(ct).decode("ascii"),
    }
    # Round-trip check before writing.
    pt = AESGCM(key).decrypt(iv, ct, None)
    if json.loads(pt.decode("utf-8")) != data:
        sys.exit("round-trip check failed; nothing written")
    json.dump(env, open(enc_path, "w", encoding="utf-8"), indent=2)
    print("Wrote %s (%d entries). Commit only this file." % (enc_path, len(data["entries"])))


if __name__ == "__main__":
    main()
