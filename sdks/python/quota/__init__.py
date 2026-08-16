import os
import time
import json
import urllib.request
import urllib.error
import threading
from typing import Any, Callable, Dict, List, Optional, TypeVar

T = TypeVar('T')

class Quota:
    api_key: Optional[str] = None
    endpoint: str = "https://quota-api.up.railway.app/collector"
    project: Optional[str] = None
    agent: Optional[str] = None
    environment: Optional[str] = None
    debug: bool = False
    _is_initialized: bool = False

    @classmethod
    def _try_auto_init(cls) -> None:
        if not cls.api_key and os.getenv("QUOTA_API_KEY"):
            cls.init(
                api_key=os.getenv("QUOTA_API_KEY", ""),
                endpoint=os.getenv("QUOTA_ENDPOINT"),
                project=os.getenv("QUOTA_PROJECT"),
                agent=os.getenv("QUOTA_AGENT"),
                environment=os.getenv("QUOTA_ENVIRONMENT")
            )

    @classmethod
    def init(
        cls,
        api_key: str,
        endpoint: Optional[str] = None,
        project: Optional[str] = None,
        agent: Optional[str] = None,
        environment: Optional[str] = None,
        debug: bool = False
    ) -> None:
        """Inicializa o SDK do Quota."""
        if not api_key:
            return

        cls.api_key = api_key
        cls.endpoint = endpoint or os.getenv("QUOTA_ENDPOINT", "https://quota-api.up.railway.app/collector")
        cls.project = project
        cls.agent = agent
        cls.environment = environment
        cls.debug = debug
        cls._is_initialized = True

        if cls.debug:
            print(f"[Quota SDK] Inicializado com sucesso. Endpoint: {cls.endpoint}")

    @classmethod
    def track_usage(cls, payload: Dict[str, Any]) -> None:
        """Envia evento de telemetria para a rota /collector do Quota."""
        cls._try_auto_init()

        if not cls.api_key:
            return

        def _send():
            try:
                metadata = (payload.get("metadata", {}) or {}) if isinstance(payload, dict) else {}
                final_metadata = {
                    "project": metadata.get("project") or cls.project,
                    "agent": metadata.get("agent") or cls.agent,
                    "environment": metadata.get("environment") or cls.environment,
                    "externalUserId": metadata.get("externalUserId"),
                    "requestGroup": metadata.get("requestGroup") or "mcp",
                    "billingGroup": metadata.get("billingGroup") or (payload.get("billingGroup") if isinstance(payload, dict) else None),
                    "tags": cls._sanitize_tags(metadata.get("tags"), ["mcp"])
                }

                final_payload = {**(payload if isinstance(payload, dict) else {}), "metadata": final_metadata}
                data = json.dumps(final_payload).encode("utf-8")

                req = urllib.request.Request(
                    cls.endpoint,
                    data=data,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {cls.api_key}",
                        "x-api-key": cls.api_key
                    },
                    method="POST"
                )

                with urllib.request.urlopen(req, timeout=5) as response:
                    if cls.debug:
                        print(f"[Quota SDK] Telemetria enviada ({response.status}): {final_payload}")
            except Exception as e:
                if cls.debug:
                    print(f"[Quota SDK] Erro ao enviar telemetria: {e}")

        threading.Thread(target=_send, daemon=True).start()

    @classmethod
    def intercept_mcp(
        cls,
        action: Callable[[], T],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        agent: Optional[str] = None,
        project: Optional[str] = None,
        environment: Optional[str] = None,
        tags: Optional[Any] = None,
        billing_group: Optional[str] = None
    ) -> T:
        """Executa e intercepta qualquer chamada MCP ou LLM capturando tokens, latência e status."""
        cls._try_auto_init()

        if not callable(action):
            return action  # type: ignore

        start_time = time.time()
        success = True
        status_code = 200
        response_data: Any = None

        try:
            response_data = action()
            return response_data
        except Exception as e:
            success = False
            status_code = getattr(e, "status_code", getattr(e, "status", getattr(e, "code", 500)))
            try:
                status_code = int(status_code)
            except Exception:
                status_code = 500
            raise e
        finally:
            latency_ms = max(0, int((time.time() - start_time) * 1000))
            tokens = cls._extract_tokens(response_data)

            inferred_model = model or getattr(response_data, "model", None) or "mcp-tool"
            inferred_provider = provider or cls._infer_provider(inferred_model)

            payload = {
                "provider": str(inferred_provider or "mcp").lower(),
                "model": str(inferred_model or "mcp-tool"),
                "promptTokens": max(0, int(tokens.get("prompt_tokens", 0) or 0)),
                "completionTokens": max(0, int(tokens.get("completion_tokens", 0) or 0)),
                "totalTokens": max(0, int(tokens.get("total_tokens", 0) or 0)),
                "cachedTokens": max(0, int(tokens.get("cached_tokens", 0) or 0)),
                "reasoningTokens": max(0, int(tokens.get("reasoning_tokens", 0) or 0)),
                "latencyMs": latency_ms,
                "statusCode": status_code,
                "success": success,
                "billingGroup": billing_group,
                "metadata": {
                    "agent": agent or cls.agent,
                    "project": project or cls.project,
                    "environment": environment or cls.environment,
                    "requestGroup": "mcp",
                    "tags": cls._sanitize_tags(tags, ["mcp"])
                }
            }

            cls.track_usage(payload)

    @classmethod
    def wrap_mcp(cls, client: Any, **default_options) -> Any:
        """Envelopa um cliente MCP (Python mcp client) com interceptação transparente de call_tool."""
        cls._try_auto_init()

        if client is None or not (isinstance(client, object)):
            return client

        original_call_tool = getattr(client, "call_tool", None)
        if callable(original_call_tool):
            def wrapped_call_tool(*args, **kwargs):
                tool_name = kwargs.get("name") or (args[0] if args else "tool")
                merged_tags = cls._sanitize_tags(default_options.get("tags"), ["mcp", f"tool:{tool_name}"])
                
                return cls.intercept_mcp(
                    action=lambda: original_call_tool(*args, **kwargs),
                    provider=default_options.get("provider", "mcp"),
                    model=default_options.get("model", f"tool:{tool_name}"),
                    agent=default_options.get("agent"),
                    project=default_options.get("project"),
                    environment=default_options.get("environment"),
                    tags=merged_tags,
                    billing_group=default_options.get("billing_group")
                )
            setattr(client, "call_tool", wrapped_call_tool)
        return client

    @staticmethod
    def _sanitize_tags(tags: Any, extra_tags: Optional[List[str]] = None) -> List[str]:
        extra = extra_tags or []
        res = []
        if isinstance(tags, (list, tuple, set)):
            res = [str(t).strip() for t in tags if t is not None and str(t).strip()]
        elif isinstance(tags, str):
            res = [t.strip() for t in tags.split(",") if t.strip()]
        return list(dict.fromkeys(res + extra))

    @staticmethod
    def _infer_provider(model_name: Optional[str]) -> str:
        if not model_name:
            return "openai"
        m = str(model_name).lower()
        if any(k in m for k in ["gpt", "o1", "o3", "dall-e", "text-embedding"]):
            return "openai"
        if any(k in m for k in ["claude", "anthropic"]):
            return "anthropic"
        if any(k in m for k in ["gemini", "palm", "gemma"]):
            return "google"
        if any(k in m for k in ["mistral", "mixtral", "codestral"]):
            return "mistral"
        if any(k in m for k in ["groq", "llama"]):
            return "groq"
        return "openai"

    @staticmethod
    def _extract_tokens(response_data: Any) -> Dict[str, int]:
        if not response_data:
            return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cached_tokens": 0, "reasoning_tokens": 0}

        usage = None
        if isinstance(response_data, dict):
            usage = response_data.get("usage") or response_data.get("usageMetadata") or response_data.get("_meta", {}).get("usage")
        else:
            usage = getattr(response_data, "usage", getattr(response_data, "usage_metadata", None))

        if not usage:
            return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cached_tokens": 0, "reasoning_tokens": 0}

        def get_val(keys, default=0):
            for k in keys:
                try:
                    if isinstance(usage, dict) and k in usage and usage[k] is not None:
                        return max(0, int(usage[k]))
                    if hasattr(usage, k) and getattr(usage, k) is not None:
                        return max(0, int(getattr(usage, k)))
                except Exception:
                    continue
            return default

        prompt_tokens = get_val(["prompt_tokens", "input_tokens", "promptTokenCount", "prompt_token_count"])
        completion_tokens = get_val(["completion_tokens", "output_tokens", "candidatesTokenCount", "candidates_token_count"])
        cached_tokens = get_val(["cached_tokens", "cache_read_input_tokens", "cachedContentTokenCount"])
        reasoning_tokens = get_val(["reasoning_tokens", "thoughtsTokenCount"])
        total_tokens = get_val(["total_tokens", "totalTokenCount"], prompt_tokens + completion_tokens)

        return {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cached_tokens": cached_tokens,
            "reasoning_tokens": reasoning_tokens
        }
