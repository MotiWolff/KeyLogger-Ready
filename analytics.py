import sqlite3
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class Analytics:
    def __init__(self, db_path):
        self.db_path = db_path

    def get_stats(self, device_id=None, days=7):
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            query = """
                SELECT 
                    COUNT(*) as total_entries,
                    COUNT(DISTINCT device_id) as unique_devices,
                    SUM(LENGTH(content)) as total_chars,
                    MIN(timestamp) as first_log,
                    MAX(timestamp) as last_log
                FROM keystrokes
                WHERE timestamp >= ?
            """
            
            params = [start_date.strftime('%Y-%m-%d')]
            
            if device_id:
                query += " AND device_id = ?"
                params.append(device_id)
            
            c.execute(query, params)
            result = c.fetchone()
            
            stats = {
                'total_entries': result[0],
                'unique_devices': result[1],
                'total_chars': result[2] or 0,
                'first_log': result[3],
                'last_log': result[4],
                'days_analyzed': days
            }
            
            conn.close()
            return stats
            
        except Exception as e:
            logger.error(f"Error getting analytics: {e}")
            return None 