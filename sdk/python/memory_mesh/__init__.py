from typing import List, Dict, Optional
import requests
from urllib.parse import urlencode


class MemoryMeshClient:
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.example.com"

    def add_memories(self, memories: List[Dict]) -> List[str]:
        response = requests.post(
            f"{self.base_url}/api/v1/mesh/memories",
            json={"memories": memories},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("stored_ids", [])

    def query_memories(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict] = None,
    ) -> List[Dict]:
        import json
        params = {"q": query, "limit": limit}
        if filters:
            params["filters"] = json.dumps(filters)

        response = requests.get(
            f"{self.base_url}/api/v1/mesh/memories/query",
            params=params,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("hits", [])


__all__ = ["MemoryMeshClient"]
