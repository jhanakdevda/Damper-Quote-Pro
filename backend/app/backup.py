import os
import sqlite3
import shutil
from datetime import datetime
from app.config import settings

def run_backup(backup_dir: str = "./backups"):
    """
    Safely backs up the SQLite database using SQLite's online backup API
    to prevent file locking or corruption issues during concurrent writes.
    """
    os.makedirs(backup_dir, exist_ok=True)
    
    # Extract db path from DATABASE_URL
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        source_path = db_url.replace("sqlite:///", "")
    else:
        source_path = "./damper_quote_pro.db"

    if not os.path.exists(source_path):
        print(f"Source database file not found: {source_path}")
        return False

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"damper_quote_pro_backup_{timestamp}.db"
    dest_path = os.path.join(backup_dir, backup_filename)

    print(f"Starting online backup of {source_path} to {dest_path}...")
    source_conn = sqlite3.connect(source_path)
    dest_conn = sqlite3.connect(dest_path)

    try:
        source_conn.backup(dest_conn)
        print(f"Backup completed successfully: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        
        # Cleanup: keep only the last 30 daily backups
        all_backups = sorted([
            os.path.join(backup_dir, f)
            for f in os.listdir(backup_dir)
            if f.startswith("damper_quote_pro_backup_") and f.endswith(".db")
        ])
        if len(all_backups) > 30:
            for old_file in all_backups[:-30]:
                os.remove(old_file)
                print(f"Removed rotated old backup: {old_file}")

        return True
    finally:
        dest_conn.close()
        source_conn.close()

if __name__ == "__main__":
    run_backup()
