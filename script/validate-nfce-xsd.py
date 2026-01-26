#!/usr/bin/env python
import argparse
import os
import re
import sys
import urllib.request
import zipfile
import shutil
import xml.etree.ElementTree as ET
import tempfile

DEFAULT_BASE_URL = "https://raw.githubusercontent.com/nfephp-org/sped-nfe/master/schemes/PL_009_V4/"
DEFAULT_OUT_DIR = os.path.join("server", "xsd", "PL_009_V4_github")
ROOT_XSD = "enviNFe_v4.00.xsd"


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def download(url: str, dest: str, refresh: bool) -> None:
    if os.path.exists(dest) and not refresh:
        return
    print(f"Downloading {url}")
    with urllib.request.urlopen(url) as resp:
        data = resp.read()
    with open(dest, "wb") as f:
        f.write(data)


def extract_schema_locations(xsd_path: str) -> list:
    try:
        tree = ET.parse(xsd_path)
    except ET.ParseError:
        # Fallback: simple regex if namespace prefixes confuse the parser.
        text = open(xsd_path, "r", encoding="utf-8", errors="ignore").read()
        return re.findall(r'schemaLocation="([^"]+)"', text)
    root = tree.getroot()
    locations = []
    for elem in root.iter():
        loc = elem.attrib.get("schemaLocation")
        if loc:
            locations.append(loc)
    return locations


def fetch_schemas(base_url: str, out_dir: str, refresh: bool) -> str:
    ensure_dir(out_dir)
    queue = [ROOT_XSD]
    seen = set()
    while queue:
        name = queue.pop(0)
        if name in seen:
            continue
        seen.add(name)
        dest = os.path.join(out_dir, name)
        url = base_url.rstrip("/") + "/" + name
        download(url, dest, refresh)
        for loc in extract_schema_locations(dest):
            loc_name = os.path.basename(loc)
            if loc_name and loc_name not in seen:
                queue.append(loc_name)
    return os.path.join(out_dir, ROOT_XSD)


def find_root_xsd(search_dir: str) -> str:
    for root, _, files in os.walk(search_dir):
        if ROOT_XSD in files:
            return os.path.join(root, ROOT_XSD)
    return ""


def extract_zip(zip_path: str, out_dir: str, refresh: bool) -> str:
    if refresh and os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    ensure_dir(out_dir)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(out_dir)
    root_xsd = find_root_xsd(out_dir)
    if not root_xsd:
        raise FileNotFoundError(f"{ROOT_XSD} not found inside ZIP")
    return root_xsd


def strip_signature(xml_path: str) -> str:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    removed = 0
    for parent in root.iter():
        for child in list(parent):
            tag = child.tag or ""
            if tag == "Signature" or tag.endswith("}Signature"):
                parent.remove(child)
                removed += 1
    if removed == 0:
        return xml_path
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xml")
    tmp_path = tmp.name
    tmp.close()
    tree.write(tmp_path, encoding="utf-8", xml_declaration=True)
    return tmp_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml", required=True, help="XML file path")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for XSD files")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR, help="Directory to store XSDs")
    parser.add_argument("--zip-url", help="URL of official XSD ZIP (optional)")
    parser.add_argument("--zip-path", help="Local path to official XSD ZIP (optional)")
    parser.add_argument("--refresh", action="store_true", help="Redownload XSD files")
    parser.add_argument("--keep-signature", action="store_true", help="Validate Signature (default strips it)")
    args = parser.parse_args()

    try:
        import xmlschema  # type: ignore
    except Exception:
        print("Missing dependency: xmlschema")
        print("Install with: python -m pip install xmlschema")
        return 1

    if not os.path.exists(args.xml):
        print(f"XML not found: {args.xml}")
        return 1

    if args.zip_url or args.zip_path:
        zip_out_dir = os.path.join(args.out_dir, "zip_extracted")
        if args.zip_url:
            zip_path = os.path.join(args.out_dir, "xsd.zip")
            download(args.zip_url, zip_path, args.refresh)
        else:
            zip_path = args.zip_path
        if not zip_path or not os.path.exists(zip_path):
            print(f"ZIP not found: {zip_path}")
            return 1
        root_xsd = extract_zip(zip_path, zip_out_dir, args.refresh)
        print(f"Using XSD from ZIP: {root_xsd}")
    else:
        root_xsd = fetch_schemas(args.base_url, args.out_dir, args.refresh)
        print(f"Using XSD: {root_xsd}")

    xml_to_validate = args.xml
    temp_xml = None
    if not args.keep_signature:
        xml_to_validate = strip_signature(args.xml)
        if xml_to_validate != args.xml:
            temp_xml = xml_to_validate
            print(f"Signature stripped for validation: {xml_to_validate}")

    schema = xmlschema.XMLSchema(root_xsd)
    errors = list(schema.iter_errors(xml_to_validate))
    if not args.keep_signature:
        filtered = []
        for err in errors:
            reason = getattr(err, "reason", "") or ""
            path = getattr(err, "path", "") or ""
            if "Signature" in reason or "Signature" in path:
                continue
            filtered.append(err)
        errors = filtered
    if temp_xml:
        try:
            os.unlink(temp_xml)
        except OSError:
            pass
    if not errors:
        print("XML is valid against XSD.")
        return 0

    print(f"Found {len(errors)} error(s):")
    for err in errors:
        line = getattr(err, "sourceline", None) or getattr(err, "line", None)
        col = getattr(err, "sourcecolumn", None) or getattr(err, "column", None)
        pos = getattr(err, "position", None)
        if pos and isinstance(pos, (tuple, list)) and len(pos) >= 2:
            line = line or pos[0]
            col = col or pos[1]
        location = ""
        if line is not None:
            location = f" (line {line}"
            if col is not None:
                location += f", col {col}"
            location += ")"
        path = getattr(err, "path", None)
        reason = getattr(err, "reason", None)
        print(f"- {err}{location}")
        if path:
            print(f"  path: {path}")
        if reason:
            print(f"  reason: {reason}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
