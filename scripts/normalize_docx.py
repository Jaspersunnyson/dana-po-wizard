#!/usr/bin/env python3
"""
Normalize DOCX template tags from {#tag} to {{#tag}}
Handles section tags: {#...}, {/...}, {^...}
"""
import sys
import zipfile
import re
from pathlib import Path
import tempfile
import shutil

# Match {#tag}, {/tag}, {^tag} but not {{#tag}}
TAG_PATTERN = re.compile(
    r'(?<!\{)\{([#/\^])\s*([A-Za-z0-9_.-]+)\s*\}(?!\})'
)

def normalize_xml_text(text: str) -> tuple[str, int]:
    """Replace single-brace tags with double-brace tags."""
    replacements = 0
    
    def replacer(match):
        nonlocal replacements
        replacements += 1
        operator = match.group(1)
        tag_name = match.group(2).strip()
        return f'{{{{{operator}{tag_name}}}}}'
    
    normalized = TAG_PATTERN.sub(replacer, text)
    return normalized, replacements

def process_docx(input_path: Path) -> tuple[Path, int]:
    """Process a DOCX file and return the fixed version."""
    output_path = input_path.with_name(f"{input_path.stem}.fixed{input_path.suffix}")
    total_replacements = 0
    
    # Create temp directory for extraction
    temp_dir = Path(tempfile.mkdtemp(prefix="docx_normalize_"))
    
    try:
        # Extract DOCX (which is a ZIP)
        with zipfile.ZipFile(input_path, 'r') as zip_in:
            zip_in.extractall(temp_dir)
        
        # Process all XML files
        for xml_file in temp_dir.rglob("*.xml"):
            try:
                original_text = xml_file.read_text(encoding='utf-8')
                normalized_text, count = normalize_xml_text(original_text)
                
                if count > 0:
                    xml_file.write_text(normalized_text, encoding='utf-8')
                    total_replacements += count
            except Exception as e:
                print(f"⚠️  Warning: Could not process {xml_file.name}: {e}")
        
        # Repackage as DOCX
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            for file_path in sorted(temp_dir.rglob("*")):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_dir).as_posix()
                    zip_out.write(file_path, arcname)
        
        return output_path, total_replacements
    
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    template_dir = Path("template")
    
    if not template_dir.exists():
        print("⚠️  No template/ directory found")
        return 0
    
    docx_files = list(template_dir.glob("*.docx"))
    # Skip already-fixed files
    docx_files = [f for f in docx_files if ".fixed." not in f.name]
    
    if not docx_files:
        print("ℹ️  No DOCX files to normalize")
        return 0
    
    print(f"📄 Found {len(docx_files)} template(s) to normalize")
    
    for docx_file in docx_files:
        print(f"\n🔧 Processing: {docx_file.name}")
        output_file, replacements = process_docx(docx_file)
        
        if replacements > 0:
            print(f"   ✅ Fixed {replacements} tag(s) → {output_file.name}")
        else:
            print(f"   ℹ️  No changes needed → {output_file.name}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
